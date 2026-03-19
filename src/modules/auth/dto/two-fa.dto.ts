import { IsString, IsNotEmpty, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class TwoFADto {
  @ApiProperty({
    example: "123456",
    description: "6-digit TOTP code from authenticator app",
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}
