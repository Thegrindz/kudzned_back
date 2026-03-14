import { IsEmail, IsString, IsNotEmpty, MinLength, Matches, IsOptional, Length, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/common/enums/user.enum';


export class RegisterDto {
  @ApiProperty({ 
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    example: 'SecurePass123!',
    description: 'Password must contain uppercase, lowercase, number and special character',
    minLength: 8
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password: string;

  @ApiProperty({ 
    example: 'johndoe',
    description: 'Unique username',
    minLength: 3,
    maxLength: 30
  })
  @IsString()
  @Length(3, 30)
  username: string;

  @ApiProperty({ 
    example: 'John',
    description: 'User first name'
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ 
    example: 'Doe',
    description: 'User last name'
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ 
    example: '+1234567890',
    description: 'Phone number (optional)',
    required: false
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.CUSTOMER,
    description: 'User role - determines access permissions',
    default: UserRole.CUSTOMER
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.CUSTOMER;
}