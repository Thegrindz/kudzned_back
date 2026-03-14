import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';

import { DatabaseConfig } from './config/database.config';
import appConfig from './config/app.config';

// Common services
import { ResponseService } from './common/services/response.service';
import { CloudinaryService } from './common/services/cloudinary.service';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MediaModule } from './modules/media/media.module';
import { VouchesModule } from './modules/vouches/vouches.module';
import { CashoutClipsModule } from './modules/cashout-clips/cashout-clips.module';

// Health check
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    
    // Database
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    
    // Redis/Bull Queue
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
      }),
    }),
    
    // Rate Limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }]),
    
    // Feature Modules
    AuthModule,
    UsersModule,
    WalletsModule,
    ProductsModule,
    OrdersModule,
    NotificationsModule,
    MediaModule,
    VouchesModule,
    CashoutClipsModule,
  ],
  controllers: [HealthController],
  providers: [ResponseService, CloudinaryService],
  exports: [ResponseService],
})
export class AppModule {}