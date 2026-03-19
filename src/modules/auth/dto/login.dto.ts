import { IsEmail, IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    example: "user@example.com",
    description: "User email address",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: "SecurePass123!",
    description: "User password",
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
