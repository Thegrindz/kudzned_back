import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrdersController } from './orders.controller';
import { CartController } from './cart.controller';
import { OrdersService } from './orders.service';
import { CartService } from './cart.service';
import { FulfillmentService } from './fulfillment.service';

import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Cart } from '../../database/entities/cart.entity';
import { CartItem } from '../../database/entities/cart-item.entity';
import { DownloadLink } from '../../database/entities/download-link.entity';

import { ResponseService } from '../../common/services/response.service';
import { WalletsModule } from '../wallets/wallets.module';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Cart, CartItem, DownloadLink]),
    WalletsModule,
    ProductsModule,
    NotificationsModule,
  ],
  controllers: [OrdersController, CartController],
  providers: [OrdersService, CartService, FulfillmentService, ResponseService],
  exports: [OrdersService],
})
export class OrdersModule {}