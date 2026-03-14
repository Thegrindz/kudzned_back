import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { VouchStatus, VouchTag } from '../../../database/entities/vouch.entity';

export class VouchQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by vouch status',
    enum: VouchStatus,
    example: VouchStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(VouchStatus)
  status?: VouchStatus;

  @ApiPropertyOptional({
    description: 'Filter by minimum rating',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  min_rating?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum rating',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  max_rating?: number;

  @ApiPropertyOptional({
    description: 'Filter by tags',
    enum: VouchTag,
    isArray: true,
    example: [VouchTag.FAST_DELIVERY, VouchTag.RELIABLE],
  })
  @IsOptional()
  @IsEnum(VouchTag, { each: true })
  tags?: VouchTag[];

  @ApiPropertyOptional({
    description: 'Search in comments',
    example: 'fast delivery',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['created_at', 'rating', 'helpful_count'],
    default: 'created_at',
    example: 'created_at',
  })
  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({
    description: 'Filter by verified purchase only',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  verified_only?: boolean;
}