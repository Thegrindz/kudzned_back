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

interface ValidatedItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
      return await this.orderRepository.manager.transaction(async (manager) => {
        // 1. Validate cart items and calculate total
        const { items, totalAmount } = await this.validateCartItems(
          createOrderDto.items,
        );

        // 2. Check wallet balance
        const hasBalance = await this.walletsService.checkBalance(
          userId,
          totalAmount,
        );
        if (!hasBalance) {
          return this.responseService.badRequest("Insufficient wallet balance");
        }

        // 3. Create order
        const order = manager.create(Order, {
          user_id: userId,
          total_amount: totalAmount,
          status: OrderStatus.PENDING,
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        });

        const savedOrder = await manager.save(order);
        // 4. Create order items
        const orderItems = items.map((item) =>
          manager.create(OrderItem, {
            order_id: savedOrder.id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
          }),
        );

        await manager.save(orderItems);

        // 5. Process payment
        const deductResponse = await this.walletsService.deductBalance(
          userId,
          totalAmount,
          savedOrder.id,
        );
        if (!deductResponse.success) {
          throw new Error("Payment processing failed");
        }

        // 6. Update order status
        savedOrder.payment_status = PaymentStatus.PAID;
        savedOrder.status = OrderStatus.CONFIRMED;
        await manager.save(savedOrder);

        // Send order confirmation email
        try {
          const orderWithUser = await manager.findOne(Order, {
            where: { id: savedOrder.id },
            relations: ["items", "items.product", "user"],
          });

          if (orderWithUser?.user) {
            const emailData: OrderConfirmationData = {
              customerName: `${orderWithUser.user.first_name} ${orderWithUser.user.last_name || ''}`.trim(),
              customerEmail: orderWithUser.user.email,
              orderNumber: savedOrder.id,
              orderDate: new Date().toLocaleDateString(),
              paymentMethod: "Wallet Balance",
              transactionId: savedOrder.id,
              orderItems: orderWithUser.items.map(item => ({
                name: item.product.title,
                description: item.product.description || "Digital Product",
                price: (item.unit_price / 100).toFixed(2),
              })),
              subtotal: (savedOrder.total_amount / 100).toFixed(2), // Using total_amount as subtotal since there's no separate subtotal field
              processingFee: "0.00", // No processing fee mentioned in the order entity
              totalAmount: (savedOrder.total_amount / 100).toFixed(2),
            };

            await this.mailService.sendOrderConfirmationMail(orderWithUser.user.email, emailData);
          }
        } catch (emailError) {
          console.error("Failed to send order confirmation email:", emailError);
          // Don't fail the order if email fails
        }

        // 7. Fulfill digital products
        const fulfillmentResult = await this.fulfillmentService.fulfillOrder(
          savedOrder.id,
        );
        if (fulfillmentResult.success) {
          savedOrder.fulfillment_status = FulfillmentStatus.FULFILLED;
          savedOrder.status = OrderStatus.COMPLETED;

          // Update product sales count
          for (const item of items) {
            await this.productsService.incrementSales(item.productId);
          }
        } else {
          // Refund on fulfillment failure
          await this.walletsService.refund(userId, totalAmount, savedOrder.id);
          savedOrder.status = OrderStatus.FAILED;
        }

        await manager.save(savedOrder);

        // 8. Send notification
        await this.notificationsService.sendOrderNotification(
          userId,
          savedOrder,
        );

        return this.responseService.created(
          "Order created successfully",
          savedOrder,
        );
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to create order",
        { error: error.message },
      );
    }
  }

  private async validateCartItems(items: any[]): Promise<{
    items: ValidatedItem[];
    totalAmount: number;
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
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
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

      return this.responseService.success(
        "Order retrieved successfully",
        order,
      );
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
      if (!orderResponse.success) {
        return orderResponse;
      }

      const order = orderResponse.data;

      if (order.status !== OrderStatus.PENDING) {
        return this.responseService.badRequest("Order cannot be cancelled");
      }

      // Refund if payment was processed
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

      return this.responseService.success(
        "Order retrieved successfully",
        order,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve order",
        { error: error.message },
      );
    }
  }
}
