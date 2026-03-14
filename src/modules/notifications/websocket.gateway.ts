import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { NotificationsService } from './notifications.service';

@Injectable()
@WSGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      this.connectedUsers.set(userId, client.id);
      client.join(`user_${userId}`);

      // Send pending notifications
      const notificationsResponse = await this.notificationsService.getUnreadNotifications(userId);
      if (notificationsResponse.success) {
        client.emit('pending_notifications', notificationsResponse.data);
      }

      console.log(`User ${userId} connected via WebSocket`);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Remove user from connected users map
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected from WebSocket`);
        break;
      }
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(client: Socket, notificationId: string) {
    const userId = this.getUserIdBySocketId(client.id);
    if (userId) {
      await this.notificationsService.markAsRead(userId, notificationId);
    }
  }

  @SubscribeMessage('get_unread_count')
  async handleGetUnreadCount(client: Socket) {
    const userId = this.getUserIdBySocketId(client.id);
    if (userId) {
      const countResponse = await this.notificationsService.getUnreadCount(userId);
      if (countResponse.success) {
        client.emit('unread_count', countResponse.data);
      }
    }
  }

  async sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  private getUserIdBySocketId(socketId: string): string | null {
    for (const [userId, id] of this.connectedUsers.entries()) {
      if (id === socketId) {
        return userId;
      }
    }
    return null;
  }
}