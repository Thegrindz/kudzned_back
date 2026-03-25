import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { OrdersController } from "./orders.controller";
import { CartController } from "./cart.controller";
import { OrdersService } from "./orders.service";
import { CartService } from "./cart.service";
import { FulfillmentService } from "./fulfillment.service";

import { Order } from "../../database/entities/order.entity";
import { OrderItem } from "../../database/entities/order-item.entity";
import { Cart } from "../../database/entities/cart.entity";
import { CartItem } from "../../database/entities/cart-item.entity";
import { DownloadLink } from "../../database/entities/download-link.entity";
import { Wallet } from "../../database/entities/wallet.entity";
import { Transaction } from "../../database/entities/transaction.entity";

import { ResponseService } from "../../common/services/response.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { MailService } from "@/common/mailer/mailer.service";
import { ProductsService } from "../products/products.service";
import { Product } from "@/database/entities/product.entity";
import { DigitalFile } from "@/database/entities/digital-file.entity";
import { CloudinaryService } from "@/common/services/cloudinary.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Cart,
      CartItem,
      DownloadLink,
      Wallet,
      Transaction,
      Product,
      DigitalFile,
    ]),
    NotificationsModule,
  ],
  controllers: [OrdersController, CartController],
  providers: [
    OrdersService,
    CartService,
    FulfillmentService,
    ResponseService,
    MailService,
    ProductsService,
    CloudinaryService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
