import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { VouchHelpfulnessType } from '../../../database/entities/vouch-helpfulness.entity';

export class VouchHelpfulnessDto {
  @ApiProperty({
    description: 'Type of helpfulness vote',
    enum: VouchHelpfulnessType,
    example: VouchHelpfulnessType.HELPFUL,
  })
  @IsEnum(VouchHelpfulnessType)
  vote_type: VouchHelpfulnessType;
}