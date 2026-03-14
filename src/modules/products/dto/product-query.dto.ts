import {
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../../../common/enums/product.enum';

export class ProductQueryDto {
  @ApiProperty({ 
    example: 1,
    description: 'Page number',
    required: false,
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ 
    example: 20,
    description: 'Items per page',
    required: false,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ 
    example: 'ebook',
    description: 'Search term',
    required: false
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ 
    example: 'uuid-string',
    description: 'Filter by category ID',
    required: false
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiProperty({ 
    example: 1000,
    description: 'Minimum price in satoshis',
    required: false,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @ApiProperty({ 
    example: 100000,
    description: 'Maximum price in satoshis',
    required: false,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @ApiProperty({ 
    example: ['ebook', 'marketing'],
    description: 'Filter by tags',
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ 
    example: 'active',
    enum: ProductStatus,
    description: 'Filter by status',
    required: false
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiProperty({ 
    example: 'created_at',
    description: 'Sort field',
    required: false
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiProperty({ 
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    description: 'Sort order',
    required: false
  })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';
}