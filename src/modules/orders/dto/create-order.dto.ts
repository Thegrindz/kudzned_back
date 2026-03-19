import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class CreateOrderItemDto {
  @ApiProperty({
    description: "Product ID to order",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: "Quantity of the product to order",
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: "Array of items to order",
    type: [CreateOrderItemDto],
    example: [
      {
        productId: "123e4567-e89b-12d3-a456-426614174000",
        quantity: 2,
      },
      {
        productId: "987fcdeb-51a2-43d1-9c4b-123456789abc",
        quantity: 1,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
