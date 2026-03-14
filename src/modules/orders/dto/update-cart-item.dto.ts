import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'New quantity for the cart item (0 to remove item)',
    example: 3,
    minimum: 0,
    maximum: 100
  })
  @IsInt()
  @Min(0)
  @Max(100)
  quantity: number;
}