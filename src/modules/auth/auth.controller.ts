import { Controller, Post, Body, UseGuards, Req, Get } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { StandardResponse } from "../../common/services/response.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { TwoFADto } from "./dto/two-fa.dto";
import {
  AuthResponseDto,
  TwoFASetupResponseDto,
  RefreshTokenResponseDto,
  UserResponseDto,
} from "./dto/auth-response.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({
    summary: "Register new user",
    description:
      "Create a new user account with specified role (customer, vendor, or admin). Defaults to customer if no role specified.",
  })
  @ApiBody({
    type: RegisterDto,
    examples: {
      customer: {
        summary: "Customer Registration",
        description: "Register as a customer (default role)",
        value: {
          email: "customer@example.com",
          password: "SecurePass123!",
          username: "customer123",
          first_name: "John",
          last_name: "Doe",
          phone_number: "+1234567890",
          role: "customer",
        },
      },
      vendor: {
        summary: "Vendor Registration",
        description: "Register as a vendor to sell products",
        value: {
          email: "vendor@example.com",
          password: "SecurePass123!",
          username: "vendor123",
          first_name: "Jane",
          last_name: "Smith",
          phone_number: "+1234567890",
          role: "vendor",
        },
      },
      admin: {
        summary: "Admin Registration",
        description: "Register as an admin (full system access)",
        value: {
          email: "admin@example.com",
          password: "SecurePass123!",
          username: "admin123",
          first_name: "Admin",
          last_name: "User",
          phone_number: "+1234567890",
          role: "admin",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "User registered successfully",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation error or user already exists",
  })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<StandardResponse<AuthResponseDto>> {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @ApiOperation({
    summary: "User login",
    description: "Authenticate user and return JWT token",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials",
  })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<StandardResponse<AuthResponseDto>> {
    return this.authService.login(loginDto);
  }

  @Post("verify-2fa")
  @ApiOperation({
    summary: "Verify 2FA token",
    description: "Verify two-factor authentication token",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiBody({ type: TwoFADto })
  @ApiResponse({
    status: 200,
    description: "2FA verification successful",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid 2FA token",
  })
  @UseGuards(JwtAuthGuard)
  async verify2FA(
    @Req() req,
    @Body() twoFADto: TwoFADto,
  ): Promise<StandardResponse<{ verified: boolean }>> {
    return this.authService.verify2FA(req.user.id, twoFADto);
  }

  @Post("enable-2fa")
  @ApiOperation({
    summary: "Enable 2FA",
    description: "Enable two-factor authentication for the user account",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: 200,
    description: "2FA enabled successfully",
    type: TwoFASetupResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "2FA already enabled",
  })
  @UseGuards(JwtAuthGuard)
  async enable2FA(
    @Req() req,
  ): Promise<StandardResponse<TwoFASetupResponseDto>> {
    return this.authService.enable2FA(req.user.id);
  }

  @Post("disable-2fa")
  @ApiOperation({
    summary: "Disable 2FA",
    description: "Disable two-factor authentication for the user account",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: 200,
    description: "2FA disabled successfully",
  })
  @UseGuards(JwtAuthGuard)
  async disable2FA(
    @Req() req,
  ): Promise<StandardResponse<{ success: boolean }>> {
    return this.authService.disable2FA(req.user.id);
  }

  @Post("refresh")
  @ApiOperation({
    summary: "Refresh JWT token",
    description: "Get a new JWT token using the current valid token",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or expired token",
  })
  @UseGuards(JwtAuthGuard)
  async refreshToken(
    @Req() req,
  ): Promise<StandardResponse<RefreshTokenResponseDto>> {
    return this.authService.refreshToken(req.user.id);
  }

  @Get("me")
  @ApiOperation({
    summary: "Get current user",
    description: "Get current authenticated user information",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: 200,
    description: "User information retrieved successfully",
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req): Promise<StandardResponse<UserResponseDto>> {
    // Since this is just returning the user from the JWT guard, we can create a simple success response
    const responseService = new (
      await import("../../common/services/response.service")
    ).ResponseService();
    console.log(req.user);
    return responseService.success(
      "User information retrieved successfully",
      req.user,
    );
  }
}
