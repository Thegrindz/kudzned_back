import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsInt,
  IsString,
  IsEnum,
  IsArray,
  Min,
  Max,
  MinLength,
  MaxLength,
} from "class-validator";
import { VouchTag } from "../../../database/entities/vouch.entity";

export class UpdateVouchDto {
  @ApiPropertyOptional({
    description: "Rating from 1 to 5 stars",
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: "Vouch comment/review",
    minLength: 10,
    maxLength: 1000,
    example:
      "Updated review: Still a great product but delivery was slower this time.",
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({
    description: "Tags to categorize the vouch",
    enum: VouchTag,
    isArray: true,
    example: [VouchTag.RELIABLE, VouchTag.GOOD_SUPPORT],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VouchTag, { each: true })
  tags?: VouchTag[];

  @ApiPropertyOptional({
    description: "Proof image file (multipart upload)",
    type: "string",
    format: "binary",
  })
  proof_image?: any;
}
