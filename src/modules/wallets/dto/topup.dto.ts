import { IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TopupDto {
  @ApiProperty({
    description: 'Amount to deposit in satoshis (optional - if not provided, any amount can be deposited)',
    example: 100000,
    minimum: 1000,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1000) // Minimum 1000 satoshis
  amount?: number;
}