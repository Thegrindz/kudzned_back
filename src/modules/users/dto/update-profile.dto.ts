import { IsString, IsOptional, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiProperty({
    example: "johndoe",
    description: "Username (3-30 characters)",
    required: false,
    minLength: 3,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @Length(3, 30)
  username?: string;

  @ApiProperty({
    example: "John",
    description: "First name",
    required: false,
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({
    example: "Doe",
    description: "Last name",
    required: false,
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({
    example: "+1234567890",
    description: "Phone number",
    required: false,
  })
  @IsOptional()
  @IsString()
  phone_number?: string;
}
