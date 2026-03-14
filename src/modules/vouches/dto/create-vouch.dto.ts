import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, IsString, IsOptional, IsEnum, IsArray, Min, Max, MinLength, MaxLength, IsNumber } from 'class-validator';
import { VouchTag } from '../../../database/entities/vouch.entity';
import { Type } from 'class-transformer';

export class CreateVouchDto {
  @ApiProperty({
    description: 'Product ID to vouch for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional({
    description: 'Order ID (if vouch is based on a purchase)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  order_id?: string;

  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsNumber()
  @Type(()=>Number)
  rating: number;

  @ApiProperty({
    description: 'Vouch comment/review',
    minLength: 10,
    maxLength: 1000,
    example: 'Great product! Fast delivery and exactly as described. Highly recommend!',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  comment: string;

  @ApiPropertyOptional({
    description: 'Tags to categorize the vouch',
    enum: VouchTag,
    isArray: true,
    example: [VouchTag.FAST_DELIVERY, VouchTag.RELIABLE],
  })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Proof image file (multipart upload)',
    type: 'string',
    format: 'binary',
  })
  proof_image?: any;
}