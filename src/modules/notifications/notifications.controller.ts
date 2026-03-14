import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationQueryDto } from './dto/notification-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get notifications',
    description: 'Retrieve paginated list of notifications for the authenticated user'
  })
  @ApiQuery({ type: NotificationQueryDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Notifications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Notifications retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: { type: 'string', enum: ['order_created', 'deposit_confirmed', 'kyc_approved', 'kyc_rejected'] },
              title: { type: 'string', example: 'Order Created' },
              message: { type: 'string', example: 'Your order #12345678 has been created successfully.' },
              is_read: { type: 'boolean', example: false },
              data: { type: 'object', nullable: true },
              created_at: { type: 'string', format: 'date-time' }
            }
          }
        },
        metadata: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            pages: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(@Req() req: any, @Query() query: NotificationQueryDto) {
    return this.notificationsService.getNotifications(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  @Get('unread')
  @ApiOperation({ 
    summary: 'Get unread notifications',
    description: 'Retrieve all unread notifications for the authenticated user (max 50)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Unread notifications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Unread notifications retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: { type: 'string' },
              title: { type: 'string' },
              message: { type: 'string' },
              is_read: { type: 'boolean', example: false },
              data: { type: 'object', nullable: true },
              created_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadNotifications(@Req() req: any) {
    return this.notificationsService.getUnreadNotifications(req.user.id);
  }

  @Get('unread/count')
  @ApiOperation({ 
    summary: 'Get unread count',
    description: 'Get the count of unread notifications for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Unread count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Unread count retrieved successfully' },
        data: { type: 'number', example: 5 }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Post(':id/read')
  @ApiOperation({ 
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read'
  })
  @ApiParam({ name: 'id', description: 'Notification ID', format: 'uuid' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notification marked as read successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Notification marked as read successfully' },
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ 
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All notifications marked as read successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'All notifications marked as read successfully' },
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete notification',
    description: 'Delete a specific notification'
  })
  @ApiParam({ name: 'id', description: 'Notification ID', format: 'uuid' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notification deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Notification deleted successfully' },
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.deleteNotification(req.user.id, id);
  }
}