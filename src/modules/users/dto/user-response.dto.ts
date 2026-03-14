import { ApiProperty } from '@nestjs/swagger';

export class UserProfileResponseDto {
  @ApiProperty({ example: 'uuid-string' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'John' })
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  last_name: string;

  @ApiProperty({ example: '+1234567890', required: false })
  phone_number?: string;

  @ApiProperty({ example: 'customer', enum: ['customer', 'vendor', 'admin'] })
  role: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'suspended', 'banned'] })
  status: string;

  @ApiProperty({ example: 'not_started', enum: ['not_started', 'pending', 'approved', 'rejected', 'expired'] })
  kyc_status: string;

  @ApiProperty({ example: false })
  two_factor_enabled: boolean;

  @ApiProperty({ example: true })
  email_verified: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', required: false })
  last_login_at?: string;
}