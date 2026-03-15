import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { VouchesController } from "./vouches.controller";
import { VouchesService } from "./vouches.service";
import { Vouch } from "../../database/entities/vouch.entity";
import { VouchHelpfulness } from "../../database/entities/vouch-helpfulness.entity";
import { Product } from "../../database/entities/product.entity";
import { Order } from "../../database/entities/order.entity";
import { ResponseService } from "../../common/services/response.service";
import { CloudinaryService } from "../../common/services/cloudinary.service";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Vouch, VouchHelpfulness, Product, Order]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [VouchesController],
  providers: [VouchesService, ResponseService, CloudinaryService],
  exports: [VouchesService],
})
export class VouchesModule {}
