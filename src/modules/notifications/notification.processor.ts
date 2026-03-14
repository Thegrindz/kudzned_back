import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';
import { EmailService } from './email.service';

@Processor('notifications')
@Injectable()
export class NotificationProcessor {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  @Process('send-email')
  async handleSendEmail(job: Job<{ notificationId: string }>) {
    const { notificationId } = job.data;

    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId },
        relations: ['user'],
      });

      if (!notification || notification.is_email_sent) {
        return;
      }

      const user = notification.user;
      if (!user || !user.email_verified) {
        return;
      }

      // Send email based on notification type
      await this.sendNotificationEmail(notification, user);

      // Mark email as sent
      await this.notificationRepository.update(notificationId, {
        is_email_sent: true,
      });

    } catch (error) {
      console.error('Failed to send notification email:', error);
      throw error;
    }
  }

  private async sendNotificationEmail(notification: Notification, user: User) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${notification.title}</h2>
        <p style="color: #666; line-height: 1.6;">${notification.message}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from KUDZNED. 
          You can manage your notification preferences in your account settings.
        </p>
      </div>
    `;

    await this.emailService.sendEmail({
      to: user.email,
      subject: `${notification.title} - KUDZNED`,
      html,
    });
  }
}