import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BTCWebhookDto {
  @ApiProperty({
    description: 'Bitcoin address that received the deposit',
    example: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Amount received in satoshis',
    example: 100000
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Bitcoin transaction hash',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'
  })
  @IsString()
  @IsNotEmpty()
  tx_hash: string;
}