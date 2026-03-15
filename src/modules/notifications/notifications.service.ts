import { Injectable, forwardRef, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";

import {
  Notification,
  NotificationType,
} from "../../database/entities/notification.entity";
import { Order } from "../../database/entities/order.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectQueue("notifications")
    private notificationQueue: Queue,
    private responseService: ResponseService,
  ) {}

  async createNotification(data: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    skipEmail?: boolean;
  }): Promise<StandardResponse<Notification>> {
    try {
      const notification = this.notificationRepository.create(data);
      const savedNotification =
        await this.notificationRepository.save(notification);

      // Queue email notification if not skipped
      if (!data.skipEmail) {
        await this.notificationQueue.add("send-email", {
          notificationId: savedNotification.id,
        });
      }

      return this.responseService.created(
        "Notification created successfully",
        savedNotification,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to create notification",
        { error: error.message },
      );
    }
  }

  async sendOrderNotification(
    userId: string,
    order: Order,
  ): Promise<StandardResponse<any>> {
    try {
      const notificationResponse = await this.createNotification({
        user_id: userId,
        type: NotificationType.ORDER_CREATED,
        title: "Order Created",
        message: `Your order #${order.id.slice(-8)} has been created successfully.`,
        data: { orderId: order.id, amount: order.total_amount },
      });

      if (notificationResponse.success) {
        return this.responseService.success(
          "Order notification sent successfully",
          { success: true },
        );
      }

      return notificationResponse as StandardResponse<any>;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to send order notification",
        { error: error.message },
      );
    }
  }

  async sendDepositNotification(
    userId: string,
    amount: number,
    txHash: string,
  ): Promise<StandardResponse<any>> {
    try {
      const notificationResponse = await this.createNotification({
        user_id: userId,
        type: NotificationType.DEPOSIT_CONFIRMED,
        title: "Deposit Confirmed",
        message: `Your Bitcoin deposit of ${amount} satoshis has been confirmed.`,
        data: { amount, txHash },
      });

      if (notificationResponse.success) {
        return this.responseService.success(
          "Deposit notification sent successfully",
          { success: true },
        );
      }

      return notificationResponse as StandardResponse<any>;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to send deposit notification",
        { error: error.message },
      );
    }
  }

  async sendKYCNotification(
    userId: string,
    approved: boolean,
  ): Promise<StandardResponse<any>> {
    try {
      const notificationResponse = await this.createNotification({
        user_id: userId,
        type: approved
          ? NotificationType.KYC_APPROVED
          : NotificationType.KYC_REJECTED,
        title: approved ? "KYC Approved" : "KYC Rejected",
        message: approved
          ? "Your KYC verification has been approved."
          : "Your KYC verification has been rejected. Please resubmit your documents.",
        data: { approved },
      });

      if (notificationResponse.success) {
        return this.responseService.success(
          "KYC notification sent successfully",
          { success: true },
        );
      }

      return notificationResponse as StandardResponse<any>;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to send KYC notification",
        { error: error.message },
      );
    }
  }

  async getNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<StandardResponse<any>> {
    try {
      const [notifications, total] =
        await this.notificationRepository.findAndCount({
          where: { user_id: userId },
          order: { created_at: "DESC" },
          skip: (page - 1) * limit,
          take: limit,
        });

      return this.responseService.paginated(
        notifications,
        page,
        limit,
        total,
        "Notifications retrieved successfully",
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve notifications",
        { error: error.message },
      );
    }
  }

  async getUnreadNotifications(
    userId: string,
  ): Promise<StandardResponse<Notification[]>> {
    try {
      const notifications = await this.notificationRepository.find({
        where: { user_id: userId, is_read: false },
        order: { created_at: "DESC" },
        take: 50,
      });

      return this.responseService.success(
        "Unread notifications retrieved successfully",
        notifications,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve unread notifications",
        { error: error.message },
      );
    }
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<StandardResponse<any>> {
    try {
      await this.notificationRepository.update(
        { id: notificationId, user_id: userId },
        { is_read: true },
      );

      return this.responseService.success(
        "Notification marked as read successfully",
        { success: true },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to mark notification as read",
        { error: error.message },
      );
    }
  }

  async markAllAsRead(userId: string): Promise<StandardResponse<any>> {
    try {
      await this.notificationRepository.update(
        { user_id: userId, is_read: false },
        { is_read: true },
      );

      return this.responseService.success(
        "All notifications marked as read successfully",
        { success: true },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to mark all notifications as read",
        { error: error.message },
      );
    }
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<StandardResponse<any>> {
    try {
      await this.notificationRepository.delete({
        id: notificationId,
        user_id: userId,
      });

      return this.responseService.success("Notification deleted successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to delete notification",
        { error: error.message },
      );
    }
  }

  async getUnreadCount(userId: string): Promise<StandardResponse<number>> {
    try {
      const count = await this.notificationRepository.count({
        where: { user_id: userId, is_read: false },
      });

      return this.responseService.success(
        "Unread count retrieved successfully",
        count,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve unread count",
        { error: error.message },
      );
    }
  }
}
