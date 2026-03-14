import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CashoutClip, CashoutClipStatus } from '../../database/entities/cashout-clip.entity';
import { Product } from '../../database/entities/product.entity';
import { ResponseService, StandardResponse } from '../../common/services/response.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { CreateCashoutClipDto } from './dto/create-cashout-clip.dto';
import { UpdateCashoutClipDto } from './dto/update-cashout-clip.dto';
import { CashoutClipQueryDto } from './dto/cashout-clip-query.dto';

@Injectable()
export class CashoutClipsService {
  constructor(
    @InjectRepository(CashoutClip)
    private cashoutClipRepository: Repository<CashoutClip>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private responseService: ResponseService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    createCashoutClipDto: CreateCashoutClipDto,
    files?: { video?: Express.Multer.File[], thumbnail?: Express.Multer.File[] },
  ): Promise<StandardResponse<CashoutClip>> {
    try {
      const { product_id, video, thumbnail, ...clipData } = createCashoutClipDto;

      // Check if product exists
      const product = await this.productRepository.findOne({
        where: { id: product_id },
      });

      if (!product) {
        return this.responseService.notFound('Product not found');
      }

      // Upload video file (required)
      if (!files?.video || !files.video[0]) {
        return this.responseService.badRequest('Video file is required');
      }

      const videoFile = files.video[0];
      let videoUploadResult;
      try {
        videoUploadResult = await this.cloudinaryService.uploadFile(
          videoFile,
          'cashout-clips/videos',
          { resource_type: 'video' }
        );
      } catch (uploadError) {
        console.error('Video upload error:', uploadError);
        return this.responseService.internalServerError('Failed to upload video file', { 
          error: uploadError.message 
        });
      }

      // Upload thumbnail if provided, otherwise generate from video
      let thumbnailUrl: string | undefined;
      if (files?.thumbnail && files.thumbnail[0]) {
        try {
          const thumbnailUploadResult = await this.cloudinaryService.uploadFile(
            files.thumbnail[0],
            'cashout-clips/thumbnails'
          );
          thumbnailUrl = thumbnailUploadResult.secure_url;
        } catch (uploadError) {
          console.error('Thumbnail upload error:', uploadError);
          return this.responseService.internalServerError('Failed to upload thumbnail', { 
            error: uploadError.message 
          });
        }
      } else {
        // Generate thumbnail from video
        thumbnailUrl = videoUploadResult.secure_url.replace('/video/upload/', '/video/upload/so_0,w_400,h_300,c_fill/');
      }

      // Create cashout clip
      const cashoutClip = this.cashoutClipRepository.create({
        ...clipData,
        user_id: userId,
        product_id,
        video_url: videoUploadResult.secure_url,
        thumbnail_url: thumbnailUrl,
        status: CashoutClipStatus.APPROVED, // All clips start as pending for moderation
      });

      const savedClip = await this.cashoutClipRepository.save(cashoutClip);

      // Fetch complete clip with relations
      const completeClip = await this.cashoutClipRepository.findOne({
        where: { id: savedClip.id },
        relations: ['user', 'product'],
      });

      return this.responseService.created('Cashout clip created successfully', completeClip);
    } catch (error) {
      return this.responseService.internalServerError('Failed to create cashout clip', { error: error.message });
    }
  }

  async findAll(query: CashoutClipQueryDto): Promise<StandardResponse<any>> {
    try {
      const {
        page = 1,
        limit = 20,
        product_id,
        user_id,
        status = CashoutClipStatus.APPROVED,
        cashout_type,
        min_amount,
        max_amount,
        search,
        tags,
        sort_by = 'created_at',
        sort_order = 'DESC',
        is_featured,
      } = query;

      const queryBuilder = this.cashoutClipRepository
        .createQueryBuilder('clip')
        .leftJoinAndSelect('clip.user', 'user')
        .leftJoinAndSelect('clip.product', 'product')
        .where('clip.is_deleted = :isDeleted', { isDeleted: false });

      if (status) {
        queryBuilder.andWhere('clip.status = :status', { status });
      }

      if (product_id) {
        queryBuilder.andWhere('clip.product_id = :product_id', { product_id });
      }

      if (user_id) {
        queryBuilder.andWhere('clip.user_id = :user_id', { user_id });
      }

      if (cashout_type) {
        queryBuilder.andWhere('clip.cashout_type = :cashout_type', { cashout_type });
      }

      if (min_amount) {
        queryBuilder.andWhere('clip.amount >= :min_amount', { min_amount });
      }

      if (max_amount) {
        queryBuilder.andWhere('clip.amount <= :max_amount', { max_amount });
      }

      if (search) {
        queryBuilder.andWhere(
          '(clip.title ILIKE :search OR clip.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (tags && tags.length > 0) {
        queryBuilder.andWhere('clip.tags && :tags', { tags });
      }

      if (is_featured !== undefined) {
        queryBuilder.andWhere('clip.is_featured = :is_featured', { is_featured });
      }

      queryBuilder
        .orderBy(`clip.${sort_by}`, sort_order)
        .skip((page - 1) * limit)
        .take(limit);

      const [clips, total] = await queryBuilder.getManyAndCount();

      return this.responseService.paginated(clips, page, limit, total, 'Cashout clips retrieved successfully');
    } catch (error) {
      return this.responseService.internalServerError('Failed to retrieve cashout clips', { error: error.message });
    }
  }

  async findById(id: string): Promise<StandardResponse<CashoutClip>> {
    try {
      const clip = await this.cashoutClipRepository.findOne({
        where: { id, is_deleted: false },
        relations: ['user', 'product'],
      });

      if (!clip) {
        return this.responseService.notFound('Cashout clip not found');
      }

      return this.responseService.success('Cashout clip retrieved successfully', clip);
    } catch (error) {
      return this.responseService.internalServerError('Failed to retrieve cashout clip', { error: error.message });
    }
  }

  async update(
    id: string,
    userId: string,
    updateCashoutClipDto: UpdateCashoutClipDto,
    files?: { video?: Express.Multer.File[], thumbnail?: Express.Multer.File[] },
  ): Promise<StandardResponse<CashoutClip>> {
    try {
      const clipResponse = await this.findById(id);
      if (!clipResponse.success) {
        return clipResponse;
      }

      const clip = clipResponse.data;

      // Check if user owns the clip
      if (clip.user_id !== userId) {
        return this.responseService.forbidden('You can only update your own cashout clips');
      }

      const { video, thumbnail, ...clipData } = updateCashoutClipDto;
      let updateData: any = { ...clipData };

      // Upload new video if provided
      if (files?.video && files.video[0]) {
        const videoFile = files.video[0];
        const videoUploadResult = await this.cloudinaryService.uploadFile(
          videoFile,
          'cashout-clips/videos',
          { resource_type: 'video' }
        );
        updateData.video_url = videoUploadResult.secure_url;

        // Generate new thumbnail from new video if no thumbnail provided
        if (!files?.thumbnail || !files.thumbnail[0]) {
          updateData.thumbnail_url = videoUploadResult.secure_url.replace('/video/upload/', '/video/upload/so_0,w_400,h_300,c_fill/');
        }
      }

      // Upload new thumbnail if provided
      if (files?.thumbnail && files.thumbnail[0]) {
        const thumbnailUploadResult = await this.cloudinaryService.uploadFile(
          files.thumbnail[0],
          'cashout-clips/thumbnails'
        );
        updateData.thumbnail_url = thumbnailUploadResult.secure_url;
      }

      // Reset to pending for re-moderation if content changed
      updateData.status = CashoutClipStatus.PENDING;

      await this.cashoutClipRepository.update(id, updateData);

      const updatedClipResponse = await this.findById(id);
      return this.responseService.success('Cashout clip updated successfully', updatedClipResponse.data);
    } catch (error) {
      return this.responseService.internalServerError('Failed to update cashout clip', { error: error.message });
    }
  }

  async delete(id: string, userId: string): Promise<StandardResponse<any>> {
    try {
      const clipResponse = await this.findById(id);
      if (!clipResponse.success) {
        return clipResponse;
      }

      const clip = clipResponse.data;

      // Check if user owns the clip
      if (clip.user_id !== userId) {
        return this.responseService.forbidden('You can only delete your own cashout clips');
      }

      // Soft delete
      await this.cashoutClipRepository.update(id, { is_deleted: true });

      return this.responseService.success('Cashout clip deleted successfully', { success: true });
    } catch (error) {
      return this.responseService.internalServerError('Failed to delete cashout clip', { error: error.message });
    }
  }

  async incrementViews(id: string): Promise<StandardResponse<any>> {
    try {
      const clipResponse = await this.findById(id);
      if (!clipResponse.success) {
        return clipResponse;
      }

      await this.cashoutClipRepository.increment({ id }, 'views_count', 1);

      return this.responseService.success('Views incremented successfully', { success: true });
    } catch (error) {
      return this.responseService.internalServerError('Failed to increment views', { error: error.message });
    }
  }

  async toggleLike(id: string, userId: string): Promise<StandardResponse<any>> {
    try {
      const clipResponse = await this.findById(id);
      if (!clipResponse.success) {
        return clipResponse;
      }

      // For simplicity, we'll just increment likes
      // In a real implementation, you'd want a separate likes table to track who liked what
      await this.cashoutClipRepository.increment({ id }, 'likes_count', 1);

      return this.responseService.success('Like toggled successfully', { success: true });
    } catch (error) {
      return this.responseService.internalServerError('Failed to toggle like', { error: error.message });
    }
  }

  async getFeatured(limit = 10): Promise<StandardResponse<CashoutClip[]>> {
    try {
      const clips = await this.cashoutClipRepository.find({
        where: {
          status: CashoutClipStatus.APPROVED,
          is_featured: true,
          is_deleted: false,
        },
        relations: ['user', 'product'],
        order: { views_count: 'DESC', likes_count: 'DESC' },
        take: limit,
      });

      return this.responseService.success('Featured cashout clips retrieved successfully', clips);
    } catch (error) {
      return this.responseService.internalServerError('Failed to retrieve featured clips', { error: error.message });
    }
  }

  async getProductClips(productId: string, limit = 10): Promise<StandardResponse<CashoutClip[]>> {
    try {
      const clips = await this.cashoutClipRepository.find({
        where: {
          product_id: productId,
          status: CashoutClipStatus.APPROVED,
          is_deleted: false,
        },
        relations: ['user'],
        order: { views_count: 'DESC', created_at: 'DESC' },
        take: limit,
      });

      return this.responseService.success('Product cashout clips retrieved successfully', clips);
    } catch (error) {
      return this.responseService.internalServerError('Failed to retrieve product clips', { error: error.message });
    }
  }

  // Admin methods
  async moderateClip(id: string, status: CashoutClipStatus, rejectionReason?: string): Promise<StandardResponse<CashoutClip>> {
    try {
      const clipResponse = await this.findById(id);
      if (!clipResponse.success) {
        return clipResponse;
      }

      const updateData: any = { status };
      if (status === CashoutClipStatus.REJECTED && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      await this.cashoutClipRepository.update(id, updateData);

      const updatedClipResponse = await this.findById(id);
      return this.responseService.success('Cashout clip moderated successfully', updatedClipResponse.data);
    } catch (error) {
      return this.responseService.internalServerError('Failed to moderate cashout clip', { error: error.message });
    }
  }

  async toggleFeatured(id: string): Promise<StandardResponse<CashoutClip>> {
    try {
      const clipResponse = await this.findById(id);
      if (!clipResponse.success) {
        return clipResponse;
      }

      const clip = clipResponse.data;
      await this.cashoutClipRepository.update(id, { is_featured: !clip.is_featured });

      const updatedClipResponse = await this.findById(id);
      return this.responseService.success('Featured status toggled successfully', updatedClipResponse.data);
    } catch (error) {
      return this.responseService.internalServerError('Failed to toggle featured status', { error: error.message });
    }
  }
}