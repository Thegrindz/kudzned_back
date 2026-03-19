import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsString,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { CashoutClipStatus } from "../../../database/entities/cashout-clip.entity";

export class CashoutClipQueryDto {
  @ApiPropertyOptional({
    description: "Page number for pagination",
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
    description: "Number of items per page",
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
    description: "Filter by product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({
    description: "Filter by user ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    description: "Filter by clip status",
    enum: CashoutClipStatus,
    example: CashoutClipStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(CashoutClipStatus)
  status?: CashoutClipStatus;

  @ApiPropertyOptional({
    description: "Filter by cashout type",
  })
  @IsOptional()
  @IsString()
  cashout_type?: string;

  @ApiPropertyOptional({
    description: "Filter by minimum amount",
    minimum: 0,
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_amount?: number;

  @ApiPropertyOptional({
    description: "Filter by maximum amount",
    minimum: 0,
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_amount?: number;

  @ApiPropertyOptional({
    description: "Search in title and description",
    example: "bank transfer",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by tags",
    isArray: true,
    example: ["bank-transfer", "fast-cashout"],
  })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["created_at", "amount", "views_count", "likes_count"],
    default: "created_at",
    example: "created_at",
  })
  @IsOptional()
  @IsString()
  sort_by?: string = "created_at";

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["ASC", "DESC"],
    default: "DESC",
    example: "DESC",
  })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sort_order?: "ASC" | "DESC" = "DESC";

  @ApiPropertyOptional({
    description: "Filter by featured clips only",
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  is_featured?: boolean;
}
