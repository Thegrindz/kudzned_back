import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";

import { User } from "../../database/entities/user.entity";
import { Wallet } from "../../database/entities/wallet.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../../database/entities/notification.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private responseService: ResponseService,
    private notificationsService: NotificationsService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({ where: { email } });
  }

  async getProfile(userId: string): Promise<StandardResponse<any>> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          "id",
          "email",
          "username",
          "first_name",
          "last_name",
          "phone_number",
          "role",
          "status",
          "kyc_status",
          "two_factor_enabled",
          "email_verified",
          "created_at",
          "last_login_at",
        ],
      });

      if (!user) {
        return this.responseService.notFound("User not found");
      }

      return this.responseService.success(
        "Profile retrieved successfully",
        user,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve profile",
        { error: error.message },
      );
    }
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<StandardResponse<any>> {
    try {
      const user = await this.findById(userId);

      // Check if username is being changed and is unique
      if (
        updateProfileDto.username &&
        updateProfileDto.username !== user.username
      ) {
        const existingUser = await this.userRepository.findOne({
          where: { username: updateProfileDto.username },
        });
        if (existingUser) {
          return this.responseService.badRequest("Username already taken");
        }
      }

      await this.userRepository.update(userId, updateProfileDto);

      // Send in-app notification
      await this.notificationsService.createNotification({
        user_id: userId,
        type: NotificationType.PROFILE_UPDATED,
        title: "Profile Updated",
        message: "Your profile information has been successfully updated.",
        skipEmail: true,
      });

      const updatedProfile = await this.getProfile(userId);
      return this.responseService.success(
        "Profile updated successfully",
        updatedProfile.data,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to update profile",
        { error: error.message },
      );
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<StandardResponse<any>> {
    try {
      const { current_password, new_password } = changePasswordDto;

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return this.responseService.notFound("User not found");
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        current_password,
        user.password_hash,
      );
      if (!isCurrentPasswordValid) {
        return this.responseService.badRequest("Current password is incorrect");
      }

      // Hash new password
      const saltRounds = 12;
      const new_password_hash = await bcrypt.hash(new_password, saltRounds);

      await this.userRepository.update(userId, {
        password_hash: new_password_hash,
      });

      // Send in-app notification
      await this.notificationsService.createNotification({
        user_id: userId,
        type: NotificationType.PASSWORD_CHANGED,
        title: "Password Changed",
        message: "Your account password has been successfully changed.",
        skipEmail: true,
      });

      return this.responseService.success("Password changed successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to change password",
        { error: error.message },
      );
    }
  }

  async createWalletForUser(userId: string): Promise<Wallet> {
    const wallet = this.walletRepository.create({
      user_id: userId,
      balance: 0,
      available_balance: 0,
      total_deposited: 0,
      total_withdrawn: 0,
    });

    return this.walletRepository.save(wallet);
  }

  async verifyEmail(userId: string): Promise<StandardResponse<any>> {
    try {
      await this.userRepository.update(userId, {
        email_verified: true,
        email_verification_token: null,
      });

      // Send in-app notification
      await this.notificationsService.createNotification({
        user_id: userId,
        type: NotificationType.SYSTEM,
        title: "Email Verified",
        message: "Your email address has been successfully verified.",
        skipEmail: true,
      });

      return this.responseService.success("Email verified successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to verify email",
        { error: error.message },
      );
    }
  }
}
