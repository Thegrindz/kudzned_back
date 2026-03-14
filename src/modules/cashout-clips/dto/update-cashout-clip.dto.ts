import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class UpdateCashoutClipDto {
  @ApiPropertyOptional({
    description: "Title of the cashout clip",
    minLength: 5,
    maxLength: 100,
    example: "Updated: Successfully cashed out $750 from BankLogs",
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: "Description of the cashout process",
    maxLength: 500,
    example: "Updated description with more details about the cashout process.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "Amount cashed out",
    minimum: 0.01,
    example: 750.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: "Type of cashout method used",
    example: "crypto",
  })
  @IsOptional()
  @IsString()
  cashout_type?: string;

  @ApiPropertyOptional({
    description: "Specific payment method or platform used",
    example: "Bitcoin Wallet",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_method?: string;

  @ApiPropertyOptional({
    description: "Duration of the video in seconds",
    minimum: 1,
    example: 180,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  duration_seconds?: number;

  @ApiPropertyOptional({
    description: "Tags to categorize the cashout clip",
    isArray: true,
    example: ["crypto", "bitcoin", "fast-cashout"],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
        /* fall through */
      }
    }
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

  @ApiPropertyOptional({
    description: "Video file (multipart upload)",
    type: "string",
    format: "binary",
  })
  video?: any;

  @ApiPropertyOptional({
    description: "Thumbnail image file (multipart upload)",
    type: "string",
    format: "binary",
  })
  thumbnail?: any;
}
