import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsUUID,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
} from "class-validator";
import { Type, Transform } from "class-transformer";

export class CreateCashoutClipDto {
  @ApiProperty({
    description: "Product ID this cashout clip is for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  product_id: string;

  @ApiProperty({
    description: "Title of the cashout clip",
    minLength: 5,
    maxLength: 100,
    example: "Successfully cashed out $500 from BankLogs",
  })
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    description: "Description of the cashout process",
    maxLength: 500,
    example:
      "Used the bank logs to successfully transfer $500 to my personal account. Process was smooth and took about 2 hours.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: "Amount cashed out",
    minimum: 0.01,
    example: 500.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: "Type of cashout method used",
  })
  @IsString()
  cashout_type: string;

  @ApiPropertyOptional({
    description: "Specific payment method or platform used",
    example: "Chase Bank",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_method?: string;

  @ApiPropertyOptional({
    description: "Duration of the video in seconds",
    minimum: 1,
    example: 120,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  duration_seconds?: number;

  @ApiPropertyOptional({
    description: "Tags to categorize the cashout clip",
    isArray: true,
    example: ["bank-transfer", "fast-cashout", "verified"],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    // Handle JSON string: '["chase","high-balance"]'
    if (typeof value === "string" && value.startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
        /* fall through */
      }
    }
    // Handle comma-separated string: 'chase,high-balance'
    if (typeof value === "string")
      return value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    return [];
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: "Video file (multipart upload) - Maximum size: 100MB",
    type: "string",
    format: "binary",
  })
  video: any;

  @ApiPropertyOptional({
    description: "Thumbnail image file (multipart upload) - Maximum size: 10MB",
    type: "string",
    format: "binary",
  })
  thumbnail?: any;
}
