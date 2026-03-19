import { IsUUID, IsInt, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddToCartDto {
  @ApiProperty({
    description: "Product ID to add to cart",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: "Quantity of the product to add",
    example: 2,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}
