import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Vouch, VouchStatus } from "../../database/entities/vouch.entity";
import {
  VouchHelpfulness,
  VouchHelpfulnessType,
} from "../../database/entities/vouch-helpfulness.entity";
import { Product } from "../../database/entities/product.entity";
import { Order } from "../../database/entities/order.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { CloudinaryService } from "../../common/services/cloudinary.service";
import { CreateVouchDto } from "./dto/create-vouch.dto";
import { UpdateVouchDto } from "./dto/update-vouch.dto";
import { VouchQueryDto } from "./dto/vouch-query.dto";
import { VouchHelpfulnessDto } from "./dto/vouch-helpfulness.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../../database/entities/notification.entity";

@Injectable()
export class VouchesService {
  constructor(
    @InjectRepository(Vouch)
    private vouchRepository: Repository<Vouch>,
    @InjectRepository(VouchHelpfulness)
    private vouchHelpfulnessRepository: Repository<VouchHelpfulness>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private responseService: ResponseService,
    private cloudinaryService: CloudinaryService,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    createVouchDto: CreateVouchDto,
    proofImageFile?: Express.Multer.File,
  ): Promise<StandardResponse<Vouch>> {
    try {
      const { product_id, order_id, ...vouchData } = createVouchDto;

      // Check if product exists
      const product = await this.productRepository.findOne({
        where: { id: product_id },
      });

      if (!product) {
        return this.responseService.notFound("Product not found");
      }

      // Check if user already vouched for this product
      const existingVouch = await this.vouchRepository.findOne({
        where: { user_id: userId, product_id },
      });

      if (existingVouch) {
        return this.responseService.conflict(
          "You have already vouched for this product",
        );
      }

      // Verify purchase if order_id is provided
      let isVerifiedPurchase = false;
      if (order_id) {
        const order = await this.orderRepository.findOne({
          where: { id: order_id, user_id: userId },
          relations: ["items"],
        });

        if (
          order &&
          order.items.some((item) => item.product_id === product_id)
        ) {
          isVerifiedPurchase = true;
        }
      }

      // Upload proof image if provided
      let proofImageUrl: string | undefined;
      if (proofImageFile && proofImageFile.buffer) {
        const uploadResult = await this.cloudinaryService.uploadFile(
          proofImageFile,
          "vouches/proof-images",
        );
        proofImageUrl = uploadResult.secure_url;
      }

      // Create vouch
      const vouch = this.vouchRepository.create({
        ...vouchData,
        user_id: userId,
        product_id,
        order_id,
        proof_image_url: proofImageUrl,
        is_verified_purchase: isVerifiedPurchase,
        status: VouchStatus.APPROVED, // All vouches start as pending for moderation
      });

      const savedVouch = await this.vouchRepository.save(vouch);

      const completeVouch = await this.vouchRepository.findOne({
        where: { id: savedVouch.id },
        relations: ["user", "product", "order"],
      });

      // Send in-app notification
      await this.notificationsService.createNotification({
        user_id: userId,
        type: NotificationType.VOUCH_CREATED,
        title: "Vouch Submitted",
        message: "Your vouch has been successfully submitted.",
        skipEmail: true,
      });

      return this.responseService.created(
        "Vouch created successfully",
        completeVouch,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to create vouch",
        { error: error.message },
      );
    }
  }

  async findAll(query: VouchQueryDto): Promise<StandardResponse<any>> {
    try {
      const {
        page = 1,
        limit = 20,
        product_id,
        user_id,
        status = VouchStatus.APPROVED,
        min_rating,
        max_rating,
        tags,
        search,
        sort_by = "created_at",
        sort_order = "DESC",
        verified_only,
      } = query;

      const queryBuilder = this.vouchRepository
        .createQueryBuilder("vouch")
        .leftJoinAndSelect("vouch.user", "user")
        .leftJoinAndSelect("vouch.product", "product")
        .leftJoinAndSelect("vouch.order", "order")
        .where("vouch.is_deleted = :isDeleted", { isDeleted: false });

      if (status) {
        queryBuilder.andWhere("vouch.status = :status", { status });
      }

      if (product_id) {
        queryBuilder.andWhere("vouch.product_id = :product_id", { product_id });
      }

      if (user_id) {
        queryBuilder.andWhere("vouch.user_id = :user_id", { user_id });
      }

      if (min_rating) {
        queryBuilder.andWhere("vouch.rating >= :min_rating", { min_rating });
      }

      if (max_rating) {
        queryBuilder.andWhere("vouch.rating <= :max_rating", { max_rating });
      }

      if (tags && tags.length > 0) {
        queryBuilder.andWhere("vouch.tags && :tags", { tags });
      }

      if (search) {
        queryBuilder.andWhere("vouch.comment ILIKE :search", {
          search: `%${search}%`,
        });
      }

      if (verified_only) {
        queryBuilder.andWhere("vouch.is_verified_purchase = :verified", {
          verified: true,
        });
      }

      queryBuilder
        .orderBy(`vouch.${sort_by}`, sort_order)
        .skip((page - 1) * limit)
        .take(limit);

      const [vouches, total] = await queryBuilder.getManyAndCount();

      return this.responseService.paginated(
        vouches,
        page,
        limit,
        total,
        "Vouches retrieved successfully",
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve vouches",
        { error: error.message },
      );
    }
  }

  async findById(id: string): Promise<StandardResponse<Vouch>> {
    try {
      const vouch = await this.vouchRepository.findOne({
        where: { id, is_deleted: false },
        relations: ["user", "product", "order", "helpfulness_votes"],
      });

      if (!vouch) {
        return this.responseService.notFound("Vouch not found");
      }

      return this.responseService.success(
        "Vouch retrieved successfully",
        vouch,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve vouch",
        { error: error.message },
      );
    }
  }

  async update(
    id: string,
    userId: string,
    updateVouchDto: UpdateVouchDto,
    proofImageFile?: Express.Multer.File,
  ): Promise<StandardResponse<Vouch>> {
    try {
      const vouchResponse = await this.findById(id);
      if (!vouchResponse.success) {
        return vouchResponse;
      }

      const vouch = vouchResponse.data;

      // Check if user owns the vouch
      if (vouch.user_id !== userId) {
        return this.responseService.forbidden(
          "You can only update your own vouches",
        );
      }

      // Upload new proof image if provided
      let proofImageUrl = vouch.proof_image_url;
      if (proofImageFile) {
        const uploadResult = await this.cloudinaryService.uploadFile(
          proofImageFile,
          "vouches/proof-images",
        );
        proofImageUrl = uploadResult.secure_url;
      }

      // Update vouch (reset to pending for re-moderation if content changed)
      const updateData = {
        ...updateVouchDto,
        ...(proofImageUrl && { proof_image_url: proofImageUrl }),
        status: VouchStatus.PENDING, // Re-moderate after update
      };

      await this.vouchRepository.update(id, updateData);

      const updatedVouchResponse = await this.findById(id);
      return this.responseService.success(
        "Vouch updated successfully",
        updatedVouchResponse.data,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to update vouch",
        { error: error.message },
      );
    }
  }

  async delete(id: string, userId: string): Promise<StandardResponse<any>> {
    try {
      const vouchResponse = await this.findById(id);
      if (!vouchResponse.success) {
        return vouchResponse;
      }

      const vouch = vouchResponse.data;

      // Check if user owns the vouch
      if (vouch.user_id !== userId) {
        return this.responseService.forbidden(
          "You can only delete your own vouches",
        );
      }

      // Soft delete
      await this.vouchRepository.update(id, { is_deleted: true });

      return this.responseService.success("Vouch deleted successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to delete vouch",
        { error: error.message },
      );
    }
  }

  async voteHelpfulness(
    vouchId: string,
    userId: string,
    vouchHelpfulnessDto: VouchHelpfulnessDto,
  ): Promise<StandardResponse<any>> {
    try {
      const { vote_type } = vouchHelpfulnessDto;

      // Check if vouch exists
      const vouch = await this.vouchRepository.findOne({
        where: { id: vouchId, is_deleted: false },
      });

      if (!vouch) {
        return this.responseService.notFound("Vouch not found");
      }

      // Check if user already voted
      const existingVote = await this.vouchHelpfulnessRepository.findOne({
        where: { user_id: userId, vouch_id: vouchId },
      });

      if (existingVote) {
        // Update existing vote
        if (existingVote.vote_type !== vote_type) {
          // Update counters
          if (existingVote.vote_type === VouchHelpfulnessType.HELPFUL) {
            await this.vouchRepository.decrement(
              { id: vouchId },
              "helpful_count",
              1,
            );
          } else {
            await this.vouchRepository.decrement(
              { id: vouchId },
              "not_helpful_count",
              1,
            );
          }

          if (vote_type === VouchHelpfulnessType.HELPFUL) {
            await this.vouchRepository.increment(
              { id: vouchId },
              "helpful_count",
              1,
            );
          } else {
            await this.vouchRepository.increment(
              { id: vouchId },
              "not_helpful_count",
              1,
            );
          }

          // Update vote
          await this.vouchHelpfulnessRepository.update(existingVote.id, {
            vote_type,
          });
        }

        return this.responseService.success("Vote updated successfully", {
          vote_type,
        });
      } else {
        // Create new vote
        const helpfulnessVote = this.vouchHelpfulnessRepository.create({
          user_id: userId,
          vouch_id: vouchId,
          vote_type,
        });

        await this.vouchHelpfulnessRepository.save(helpfulnessVote);

        // Update counters
        if (vote_type === VouchHelpfulnessType.HELPFUL) {
          await this.vouchRepository.increment(
            { id: vouchId },
            "helpful_count",
            1,
          );
        } else {
          await this.vouchRepository.increment(
            { id: vouchId },
            "not_helpful_count",
            1,
          );
        }

        return this.responseService.created("Vote recorded successfully", {
          vote_type,
        });
      }
    } catch (error) {
      return this.responseService.internalServerError("Failed to record vote", {
        error: error.message,
      });
    }
  }

  async getProductStats(productId: string): Promise<StandardResponse<any>> {
    try {
      const stats = await this.vouchRepository
        .createQueryBuilder("vouch")
        .select([
          "COUNT(*) as total_vouches",
          "AVG(vouch.rating) as average_rating",
          "COUNT(CASE WHEN vouch.rating = 5 THEN 1 END) as five_star",
          "COUNT(CASE WHEN vouch.rating = 4 THEN 1 END) as four_star",
          "COUNT(CASE WHEN vouch.rating = 3 THEN 1 END) as three_star",
          "COUNT(CASE WHEN vouch.rating = 2 THEN 1 END) as two_star",
          "COUNT(CASE WHEN vouch.rating = 1 THEN 1 END) as one_star",
          "COUNT(CASE WHEN vouch.is_verified_purchase = true THEN 1 END) as verified_vouches",
        ])
        .where("vouch.product_id = :productId", { productId })
        .andWhere("vouch.status = :status", { status: VouchStatus.APPROVED })
        .andWhere("vouch.is_deleted = :isDeleted", { isDeleted: false })
        .getRawOne();

      return this.responseService.success(
        "Product vouch stats retrieved successfully",
        {
          ...stats,
          average_rating: parseFloat(stats.average_rating || "0").toFixed(1),
        },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve product stats",
        { error: error.message },
      );
    }
  }

  // Admin methods
  async moderateVouch(
    id: string,
    status: VouchStatus,
    rejectionReason?: string,
  ): Promise<StandardResponse<Vouch>> {
    try {
      const vouchResponse = await this.findById(id);
      if (!vouchResponse.success) {
        return vouchResponse;
      }

      const updateData: any = { status };
      if (status === VouchStatus.REJECTED && rejectionReason) {
        // We can add a rejection_reason field to the entity if needed
      }

      await this.vouchRepository.update(id, updateData);

      const updatedVouchResponse = await this.findById(id);
      const vouch = vouchResponse.data;

      // Send in-app notification about moderation status
      if (status === VouchStatus.APPROVED || status === VouchStatus.REJECTED) {
        const type =
          status === VouchStatus.APPROVED
            ? NotificationType.VOUCH_APPROVED
            : NotificationType.VOUCH_REJECTED;
        const title =
          status === VouchStatus.APPROVED ? "Vouch Approved" : "Vouch Rejected";
        const message =
          status === VouchStatus.APPROVED
            ? "Your vouch has been approved and is now live."
            : `Your vouch has been rejected.${rejectionReason ? " Reason: " + rejectionReason : ""}`;

        await this.notificationsService.createNotification({
          user_id: vouch.user_id,
          type,
          title,
          message,
          skipEmail: true,
        });
      }

      return this.responseService.success(
        "Vouch moderated successfully",
        updatedVouchResponse.data,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to moderate vouch",
        { error: error.message },
      );
    }
  }
}
