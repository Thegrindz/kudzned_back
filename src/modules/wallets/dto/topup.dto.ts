import { IsOptional, IsNumber, Min, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class TopupDto {
  @ApiProperty({
    description: "Cryptocurrency to use for topup (BTC or ETH)",
    example: "BTC",
    enum: ["BTC", "ETH"],
    default: "BTC",
    required: false,
  })
  @IsOptional()
  @IsEnum(["BTC", "ETH"])
  currency?: "BTC" | "ETH" = "BTC";

  @ApiProperty({
    description:
      "Amount to deposit in base units (satoshis for BTC, wei for ETH) (optional)",
    example: 100000,
    minimum: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  amount?: number;
}
