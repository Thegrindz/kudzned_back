import { PartialType, OmitType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['image', 'additional_images', 'digital_file'] as const)
) {
  @ApiProperty({ 
    type: 'string',
    format: 'binary',
    description: 'New main product image file',
    required: false
  })
  @IsOptional()
  image?: any;

  @ApiProperty({ 
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'New additional product images (max 5)',
    required: false
  })
  @IsOptional()
  additional_images?: any[];

  @ApiProperty({ 
    type: 'string',
    format: 'binary',
    description: 'New digital file to replace existing one',
    required: false
  })
  @IsOptional()
  digital_file?: any;
}