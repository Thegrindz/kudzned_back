import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";

import { Order } from "../../database/entities/order.entity";
import { OrderItem } from "../../database/entities/order-item.entity";
import { Wallet } from "../../database/entities/wallet.entity";
import { Transaction } from "../../database/entities/transaction.entity";
import { DownloadLink } from "../../database/entities/download-link.entity";
import { Cart } from "../../database/entities/cart.entity";
import { CartItem } from "../../database/entities/cart-item.entity";
import {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from "../../common/enums/order.enum";
import {
  TransactionType,
  TransactionStatus,
} from "../../common/enums/transaction.enum";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";

import { NotificationsService } from "../notifications/notifications.service";
import { MailService, OrderConfirmationData } from "../../common/mailer/mailer.service";

import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderQueryDto } from "./dto/order-query.dto";
import { randomBytes } from "crypto";

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
  product: any;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(DownloadLink)
    private downloadLinkRepository: Repository<DownloadLink>,
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private responseService: ResponseService,
    private mailService: MailService,
  ) {}

  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<StandardResponse<Order>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── Step 1: Validate cart items and calculate total ──────────────────
      const { items, totalAmount } = await this.validateCartItems(
        createOrderDto.items,
        queryRunner,
      );

      // ── Step 2: Check wallet balance and lock the wallet row ─────────────
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { user_id: userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!wallet) {
        await queryRunner.rollbackTransaction();
        return this.responseService.notFound("Wallet not found");
      }

      if (wallet.available_balance < totalAmount) {
        await queryRunner.rollbackTransaction();
        return this.responseService.badRequest(
          `Insufficient wallet balance. Required: $${(totalAmount / 100).toFixed(2)}, Available: $${(wallet.available_balance / 100).toFixed(2)}`,
        );
      }

      // ── Step 3: Deduct balance ───────────────────────────────────────────
      wallet.balance -= totalAmount;
      wallet.available_balance -= totalAmount;
      await queryRunner.manager.save(wallet);

      // ── Step 4: Create order ─────────────────────────────────────────────
      const order = queryRunner.manager.create(Order, {
        user_id: userId,
        total_amount: totalAmount,
        status: OrderStatus.COMPLETED,
        payment_status: PaymentStatus.PAID,
        fulfillment_status: FulfillmentStatus.FULFILLED,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      const savedOrder = await queryRunner.manager.save(order);

      // ── Step 5: Create order items ───────────────────────────────────────
      const orderItems = items.map((item) =>
        queryRunner.manager.create(OrderItem, {
          order_id: savedOrder.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
        }),
      );
      await queryRunner.manager.save(orderItems);

      // ── Step 6: Record transaction ───────────────────────────────────────
      const transaction = queryRunner.manager.create(Transaction, {
        wallet_id: wallet.id,
        type: TransactionType.PURCHASE,
        amount: -totalAmount,
        status: TransactionStatus.CONFIRMED,
        order_id: savedOrder.id,
        description: `Purchase order ${savedOrder.id}`,
      });
      await queryRunner.manager.save(transaction);

      // ── Step 7: Create download links for digital products ───────────────
      for (const item of items) {
        for (const digitalFile of item.product.digital_files || []) {
          const downloadLink = queryRunner.manager.create(DownloadLink, {
            order_id: savedOrder.id,
            digital_file_id: digitalFile.id,
            token: randomBytes(32).toString("hex"),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            max_downloads: 5,
            download_count: 0,
            is_active: true,
          });
          await queryRunner.manager.save(downloadLink);
        }
        // Increment product sales count
        item.product.sales_count = (item.product.sales_count || 0) + item.quantity;
        await queryRunner.manager.save(item.product);
      }

      // ── Step 8: Clear the user's cart ────────────────────────────────────
      const cart = await queryRunner.manager.findOne(Cart, {
        where: { user_id: userId },
      });
      if (cart) {
        // Delete all cart items
        await queryRunner.manager.delete(CartItem, { cart_id: cart.id });
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // ── Step 8: Send notifications (outside transaction) ─────────────────
      this.sendOrderNotifications(userId, savedOrder, items).catch(console.error);

      return this.responseService.created(
        "Order created successfully",
        savedOrder,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return this.responseService.internalServerError(
        "Failed to create order",
        { error: error.message },
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async sendOrderNotifications(
    userId: string,
    order: Order,
    items: ValidatedItem[],
  ): Promise<void> {
    try {
      // Get order with relations for email
      const orderWithUser = await this.orderRepository.findOne({
        where: { id: order.id },
        relations: ["user"],
      });

      if (orderWithUser?.user) {
        const emailData: OrderConfirmationData = {
          customerName: `${orderWithUser.user.first_name} ${orderWithUser.user.last_name || ""}`.trim(),
          customerEmail: orderWithUser.user.email,
          orderNumber: order.id,
          orderDate: new Date().toLocaleDateString(),
          paymentMethod: "Wallet Balance",
          transactionId: order.id,
          orderItems: items.map((item) => ({
            name: item.product.title,
            description: item.product.description || "Digital Product",
            price: (item.unitPrice / 100).toFixed(2),
          })),
          subtotal: (order.total_amount / 100).toFixed(2),
          processingFee: "0.00",
          totalAmount: (order.total_amount / 100).toFixed(2),
        };
        await this.mailService.sendOrderConfirmationMail(
          orderWithUser.user.email,
          emailData,
        );
      }
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
    }

    try {
      await this.notificationsService.sendOrderNotification(userId, order);
    } catch (notifError) {
      console.error("Failed to send order notification:", notifError);
    }
  }

  private async validateCartItems(
    items: any[],
    queryRunner?: any,
  ): Promise<{
    items: ValidatedItem[];
    totalAmount: number;
  }> {
    let totalAmount = 0;
    const validatedItems: ValidatedItem[] = [];

    const manager = queryRunner ? queryRunner.manager : this.orderRepository.manager;

    for (const item of items) {
      const product = await manager.findOne("Product", {
        where: { id: item.productId },
        relations: ["digital_files"],
      });

      if (!product || product.status !== "active") {
        throw new Error(`Product ${item.productId} not available`);
      }

      const unitPriceCents = product.price;
      const itemTotalCents = unitPriceCents * item.quantity;
      totalAmount += itemTotalCents;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPriceCents,
        totalPrice: itemTotalCents,
        product,
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId, user_id: userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!order) {
        await queryRunner.rollbackTransaction();
        return this.responseService.notFound("Order not found");
      }

      if (order.status !== OrderStatus.PENDING) {
        await queryRunner.rollbackTransaction();
        return this.responseService.badRequest("Order cannot be cancelled");
      }

      // Refund the wallet if order was paid
      if (order.payment_status === PaymentStatus.PAID) {
        const wallet = await queryRunner.manager.findOne(Wallet, {
          where: { user_id: userId },
          lock: { mode: "pessimistic_write" },
        });

        if (wallet) {
          wallet.balance += order.total_amount;
          wallet.available_balance += order.total_amount;
          await queryRunner.manager.save(wallet);

          // Record refund transaction
          const transaction = queryRunner.manager.create(Transaction, {
            wallet_id: wallet.id,
            type: TransactionType.REFUND,
            amount: order.total_amount,
            status: TransactionStatus.CONFIRMED,
            order_id: orderId,
            description: `Refund for cancelled order ${orderId}`,
          });
          await queryRunner.manager.save(transaction);
        }
      }

      order.status = OrderStatus.CANCELLED;
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      return this.responseService.success(
        "Order cancelled successfully",
        order,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return this.responseService.internalServerError(
        "Failed to cancel order",
        { error: error.message },
      );
    } finally {
      await queryRunner.release();
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