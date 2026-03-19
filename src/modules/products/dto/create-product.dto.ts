import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ProductStatus,
  ProductAvailability,
} from "../../../common/enums/product.enum";

export class CreateProductDto {
  @ApiProperty({
    example: "Amazing Digital Product",
    description: "Product title",
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example:
      "A comprehensive guide that will help you master digital marketing",
    description: "Product description",
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: "uuid-string",
    description: "Category ID",
  })
  @IsUUID()
  category_id: string;

  @ApiProperty({
    example: 50000,
    description: "Price in satoshis",
    minimum: 1,
  })
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  @Min(1)
  price: number;

  @ApiProperty({
    type: "string",
    format: "binary",
    description: "Main product image file",
    required: false,
  })
  @IsOptional()
  image?: any;

  @ApiProperty({
    type: "array",
    items: { type: "string", format: "binary" },
    description: "Additional product images (max 5)",
    required: false,
  })
  @IsOptional()
  additional_images?: any[];

  @ApiProperty({
    example: "ebook,marketing,digital",
    description: "Product tags (comma-separated)",
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === "string") {
      return value
        .split(",")
        .map((tag: string) => tag.trim())
        .filter((tag) => tag.length > 0);
    }
    return Array.isArray(value) ? value : [];
  })
  tags?: string | string[];

  @ApiProperty({
    example: "active",
    enum: ProductStatus,
    description: "Product status",
    required: false,
    default: ProductStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiProperty({
    example: "in_stock",
    enum: ProductAvailability,
    description: "Product availability",
    required: false,
    default: ProductAvailability.IN_STOCK,
  })
  @IsOptional()
  @IsEnum(ProductAvailability)
  availability?: ProductAvailability;

  @ApiProperty({
    type: "string",
    format: "binary",
    description: "Digital file to be delivered after purchase",
    required: false,
  })
  @IsOptional()
  digital_file?: any;
}
