import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

import { User } from "../../database/entities/user.entity";
import { Wallet } from "../../database/entities/wallet.entity";
import { ResponseService } from "../../common/services/response.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [TypeOrmModule.forFeature([User, Wallet]), NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, ResponseService],
  exports: [UsersService],
})
export class UsersModule {}
