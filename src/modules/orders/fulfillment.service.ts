import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';

import { DownloadLink } from '../../database/entities/download-link.entity';
import { Order } from '../../database/entities/order.entity';
import { ResponseService, StandardResponse } from '../../common/services/response.service';

@Injectable()
export class FulfillmentService {
  constructor(
    @InjectRepository(DownloadLink)
    private downloadLinkRepository: Repository<DownloadLink>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private responseService: ResponseService,
  ) {}

  async fulfillOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items', 'items.product', 'items.product.digital_files'],
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Create download links for all digital files
      for (const item of order.items) {
        for (const digitalFile of item.product.digital_files) {
          const downloadLink = this.downloadLinkRepository.create({
            order_id: orderId,
            digital_file_id: digitalFile.id,
            token: this.generateDownloadToken(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            max_downloads: 5,
            download_count: 0,
            is_active: true,
          });

          await this.downloadLinkRepository.save(downloadLink);
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getDownloadLink(orderId: string, fileId: string, userId: string): Promise<StandardResponse<any>> {
    try {
      // First verify the order belongs to the user
      const order = await this.orderRepository.findOne({
        where: { id: orderId, user_id: userId },
      });

      if (!order) {
        return this.responseService.notFound('Order not found or access denied');
      }

      const downloadLink = await this.downloadLinkRepository.findOne({
        where: {
          order_id: orderId,
          digital_file_id: fileId,
          is_active: true,
        },
        relations: ['digital_file'],
      });

      if (!downloadLink) {
        return this.responseService.notFound('Download link not found');
      }

      // Check if link has expired
      if (downloadLink.expires_at < new Date()) {
        return this.responseService.badRequest('Download link has expired');
      }

      // Check download limit
      if (downloadLink.download_count >= downloadLink.max_downloads) {
        return this.responseService.badRequest('Download limit exceeded');
      }

      // Increment download count
      await this.downloadLinkRepository.update(downloadLink.id, {
        download_count: downloadLink.download_count + 1,
      });

      return this.responseService.success('Download link retrieved successfully', downloadLink);
    } catch (error) {
      return this.responseService.internalServerError('Failed to get download link', { error: error.message });
    }
  }

  private generateDownloadToken(): string {
    return randomBytes(32).toString('hex');
  }

  async validateDownloadToken(token: string): Promise<StandardResponse<any>> {
    try {
      const downloadLink = await this.downloadLinkRepository.findOne({
        where: { token, is_active: true },
        relations: ['digital_file', 'order'],
      });

      if (!downloadLink) {
        return this.responseService.notFound('Invalid download token');
      }

      if (downloadLink.expires_at < new Date()) {
        return this.responseService.badRequest('Download link has expired');
      }

      if (downloadLink.download_count >= downloadLink.max_downloads) {
        return this.responseService.badRequest('Download limit exceeded');
      }

      return this.responseService.success('Download token validated successfully', downloadLink);
    } catch (error) {
      return this.responseService.internalServerError('Failed to validate download token', { error: error.message });
    }
  }
}
