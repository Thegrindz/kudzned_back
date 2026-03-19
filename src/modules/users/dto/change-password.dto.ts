import { IsString, IsNotEmpty, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ChangePasswordDto {
  @ApiProperty({
    example: "CurrentPass123!",
    description: "Current password",
  })
  @IsString()
  @IsNotEmpty()
  current_password: string;

  @ApiProperty({
    example: "NewSecurePass123!",
    description:
      "New password (must contain uppercase, lowercase, number and special character)",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      "Password must contain uppercase, lowercase, number and special character",
  })
  new_password: string;
}
