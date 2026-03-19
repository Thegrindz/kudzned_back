import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
} from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({
    example: "Electronics",
    description: "Category name",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "Category description",
    description: "Category description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: "Category image URL",
    description: "Category image URL",
  })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiProperty({
    example: true,
    description: "Category active status",
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    example: 1,
    description: "Category sort order",
  })
  @IsOptional()
  @IsNumber()
  sort_order?: number;
}
