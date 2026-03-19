import { ApiProperty } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty({ example: "uuid-string" })
  id: string;

  @ApiProperty({ example: "user@example.com" })
  email: string;

  @ApiProperty({ example: "johndoe" })
  username: string;

  @ApiProperty({ example: "John" })
  first_name: string;

  @ApiProperty({ example: "Doe" })
  last_name: string;

  @ApiProperty({ example: "customer", enum: ["customer", "vendor", "admin"] })
  role: string;

  @ApiProperty({
    example: "not_started",
    enum: ["not_started", "pending", "approved", "rejected", "expired"],
  })
  kyc_status: string;

  @ApiProperty({ example: false })
  two_factor_enabled: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  access_token: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class TwoFASetupResponseDto {
  @ApiProperty({ example: "JBSWY3DPEHPK3PXP" })
  secret: string;

  @ApiProperty({
    example:
      "otpauth://totp/KUDZNED%20(user@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=KUDZNED",
  })
  qr_code: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  access_token: string;
}
