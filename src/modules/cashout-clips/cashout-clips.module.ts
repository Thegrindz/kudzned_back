import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CashoutClipsController } from './cashout-clips.controller';
import { CashoutClipsService } from './cashout-clips.service';
import { CashoutClip } from '../../database/entities/cashout-clip.entity';
import { Product } from '../../database/entities/product.entity';
import { ResponseService } from '../../common/services/response.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CashoutClip,
      Product,
    ]),
    AuthModule,
  ],
  controllers: [CashoutClipsController],
  providers: [CashoutClipsService, ResponseService, CloudinaryService],
  exports: [CashoutClipsService],
})
export class CashoutClipsModule {}