import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Order } from "../../database/entities/order.entity";
import { OrderItem } from "../../database/entities/order-item.entity";
import {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from "../../common/enums/order.enum";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";

import { WalletsService } from "../wallets/wallets.service";
import { ProductsService } from "../products/products.service";
import { NotificationsService } from "../notifications/notifications.service";
import { FulfillmentService } from "./fulfillment.service";
import { MailService, OrderConfirmationData } from "../../common/mailer/mailer.service";

import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderQueryDto } from "./dto/order-query.dto";

// ─── Price convention ────────────────────────────────────────────────────────
// Product prices are stored in USD CENTS in the DB (e.g. $0.10 = 10 cents).
// Wallet balances are also in USD CENTS.
// All arithmetic here stays in cents — never divide until displaying to user.
// ─────────────────────────────────────────────────────────────────────────────

interface ValidatedItem {
  productId: string;
  quantity: number;
  unitPrice: number;  // cents
  totalPrice: number; // cents
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private walletsService: WalletsService,
    private productsService: ProductsService,
    private notificationsService: NotificationsService,
    private fulfillmentService: FulfillmentService,
    private responseService: ResponseService,
    private mailService: MailService,
  ) {}

  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<StandardResponse<Order>> {
    try {
      // ── Step 1: Validate cart items and calculate total IN CENTS ─────────
      const { items, totalAmount } = await this.validateCartItems(
        createOrderDto.items,
      );

      // ── Step 2: Check wallet balance ─────────────────────────────────────
      const hasBalance = await this.walletsService.checkBalance(
        userId,
        totalAmount, // cents
      );
      if (!hasBalance) {
        return this.responseService.badRequest(
          `Insufficient wallet balance. Required: $${(totalAmount / 100).toFixed(2)}`,
        );
      }

      // ── Step 3: Deduct balance FIRST (outside the order transaction) ─────
      // FIX — deductBalance opens its own transaction internally.
      // Calling it inside another transaction causes a deadlock and the
      // request hangs forever. We deduct first, then create the order.
      const deductResponse = await this.walletsService.deductBalance(
        userId,
        totalAmount, // cents
        "pending", // temporary placeholder, updated after order is created
      );

      if (!deductResponse.success) {
        // Balance check passed but deduction failed — return the error
        return deductResponse as any;
      }

      // ── Step 4: Create the order and items ───────────────────────────────
      let savedOrder: Order;
      try {
        savedOrder = await this.orderRepository.manager.transaction(
          async (manager) => {
            const order = manager.create(Order, {
              user_id: userId,
              total_amount: totalAmount, // cents
              status: OrderStatus.PENDING,
              payment_status: PaymentStatus.PAID,
              expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 min
            });

            const createdOrder = await manager.save(order);

            const orderItems = items.map((item) =>
              manager.create(OrderItem, {
                order_id: createdOrder.id,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice,   // cents
                total_price: item.totalPrice, // cents
              }),
            );

            await manager.save(orderItems);

            createdOrder.status = OrderStatus.CONFIRMED;
            return manager.save(createdOrder);
          },
        );
      } catch (orderError) {
        // Order creation failed after balance was already deducted — refund it
        await this.walletsService.refund(userId, totalAmount, "order-failed");
        throw orderError;
      }

      // ── Step 5: Fulfill digital products ─────────────────────────────────
      const fulfillmentResult =
        await this.fulfillmentService.fulfillOrder(savedOrder.id);

      if (fulfillmentResult.success) {
        savedOrder.fulfillment_status = FulfillmentStatus.FULFILLED;
        savedOrder.status = OrderStatus.COMPLETED;

        for (const item of items) {
          await this.productsService.incrementSales(item.productId);
        }
      } else {
        // Fulfillment failed — refund the customer and mark order failed
        await this.walletsService.refund(userId, totalAmount, savedOrder.id);
        savedOrder.status = OrderStatus.FAILED;
      }

      await this.orderRepository.save(savedOrder);

      // ── Step 6: Send confirmation email ──────────────────────────────────
      try {
        const orderWithUser = await this.orderRepository.findOne({
          where: { id: savedOrder.id },
          relations: ["items", "items.product", "user"],
        });

        if (orderWithUser?.user) {
          const emailData: OrderConfirmationData = {
            customerName: `${orderWithUser.user.first_name} ${orderWithUser.user.last_name || ""}`.trim(),
            customerEmail: orderWithUser.user.email,
            orderNumber: savedOrder.id,
            orderDate: new Date().toLocaleDateString(),
            paymentMethod: "Wallet Balance",
            transactionId: savedOrder.id,
            orderItems: orderWithUser.items.map((item) => ({
              name: item.product.title,
              description: item.product.description || "Digital Product",
              // Display only — convert cents to dollars here
              price: (item.unit_price / 100).toFixed(2),
            })),
            subtotal: (savedOrder.total_amount / 100).toFixed(2),
            processingFee: "0.00",
            totalAmount: (savedOrder.total_amount / 100).toFixed(2),
          };
          await this.mailService.sendOrderConfirmationMail(
            orderWithUser.user.email,
            emailData,
          );
        }
      } catch (emailError) {
        // Never fail the order because of an email error
        console.error("Failed to send order confirmation email:", emailError);
      }

      // ── Step 7: Send in-app notification ─────────────────────────────────
      await this.notificationsService.sendOrderNotification(
        userId,
        savedOrder,
      );

      return this.responseService.created(
        "Order created successfully",
        savedOrder,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to create order",
        { error: error.message },
      );
    }
  }

  private async validateCartItems(items: any[]): Promise<{
    items: ValidatedItem[];
    totalAmount: number; // cents
  }> {
    let totalAmount = 0;
    const validatedItems: ValidatedItem[] = [];

    for (const item of items) {
      const productResponse = await this.productsService.findById(
        item.productId,
      );

      if (
        !productResponse.success ||
        !productResponse.data ||
        productResponse.data.status !== "active"
      ) {
        throw new Error(`Product ${item.productId} not available`);
      }

      const product = productResponse.data;

      // FIX — product.price must be in cents in the DB.
      // If your products are currently stored in dollars (e.g. 0.10),
      // you need to migrate them to cents (10) in the database.
      // All arithmetic here assumes cents.
      const unitPriceCents = product.price; // must already be in cents
      const itemTotalCents = unitPriceCents * item.quantity;
      totalAmount += itemTotalCents;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPriceCents,
        totalPrice: itemTotalCents,
      });
    }

    return { items: validatedItems, totalAmount };
  }

  async getOrders(
    userId: string,
    query: OrderQueryDto,
  ): Promise<StandardResponse<any>> {
    try {
      const { page = 1, limit = 20, status } = query;

      const queryBuilder = this.orderRepository
        .createQueryBuilder("order")
        .leftJoinAndSelect("order.items", "items")
        .leftJoinAndSelect("items.product", "product")
        .where("order.user_id = :userId", { userId })
        .orderBy("order.created_at", "DESC")
        .skip((page - 1) * limit)
        .take(limit);

      if (status) {
        queryBuilder.andWhere("order.status = :status", { status });
      }

      const [orders, total] = await queryBuilder.getManyAndCount();

      return this.responseService.paginated(
        orders,
        page,
        limit,
        total,
        "Orders retrieved successfully",
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve orders",
        { error: error.message },
      );
    }
  }

  async getOrder(
    userId: string,
    orderId: string,
  ): Promise<StandardResponse<Order>> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId, user_id: userId },
        relations: ["items", "items.product", "download_links"],
      });

      if (!order) {
        return this.responseService.notFound("Order not found");
      }

      return this.responseService.success("Order retrieved successfully", order);
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve order",
        { error: error.message },
      );
    }
  }

  async cancelOrder(
    userId: string,
    orderId: string,
  ): Promise<StandardResponse<Order>> {
    try {
      const orderResponse = await this.getOrder(userId, orderId);
      if (!orderResponse.success) return orderResponse;

      const order = orderResponse.data;

      if (order.status !== OrderStatus.PENDING) {
        return this.responseService.badRequest("Order cannot be cancelled");
      }

      if (order.payment_status === PaymentStatus.PAID) {
        await this.walletsService.refund(userId, order.total_amount, orderId);
      }

      await this.orderRepository.update(orderId, {
        status: OrderStatus.CANCELLED,
      });

      const updatedOrderResponse = await this.getOrder(userId, orderId);
      if (updatedOrderResponse.success) {
        return this.responseService.success(
          "Order cancelled successfully",
          updatedOrderResponse.data,
        );
      }

      return updatedOrderResponse;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to cancel order",
        { error: error.message },
      );
    }
  }

  async getOrderById(orderId: string): Promise<StandardResponse<Order>> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ["items", "items.product", "download_links"],
      });

      if (!order) {
        return this.responseService.notFound("Order not found");
      }

      return this.responseService.success("Order retrieved successfully", order);
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve order",
        { error: error.message },
      );
    }
  }
}