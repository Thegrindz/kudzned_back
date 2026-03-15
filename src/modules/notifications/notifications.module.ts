import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { EmailService } from "./email.service";
import { NotificationProcessor } from "./notification.processor";

import { Notification } from "../../database/entities/notification.entity";
import { User } from "../../database/entities/user.entity";
import { ResponseService } from "../../common/services/response.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    BullModule.registerQueue({
      name: "notifications",
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get("jwt.secret"),
        signOptions: { expiresIn: configService.get("jwt.expiresIn") },
      }),
    }),
    HttpModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    NotificationProcessor,
    ResponseService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
