import { Controller, Get, Put, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StandardResponse } from '../../common/services/response.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserProfileResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get('profile')
  @ApiOperation({ 
    summary: 'Get user profile',
    description: 'Get current user profile information'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ 
    status: 200, 
    description: 'Profile retrieved successfully',
    type: UserProfileResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized'
  })
  async getProfile(@Req() req): Promise<StandardResponse<any>> {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('profile')
  @ApiOperation({ 
    summary: 'Update user profile',
    description: 'Update current user profile information'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile updated successfully',
    type: UserProfileResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation error or username already taken'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized'
  })
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto): Promise<StandardResponse<any>> {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }

  @Post('change-password')
  @ApiOperation({ 
    summary: 'Change password',
    description: 'Change user password'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Password changed successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Current password is incorrect or validation error'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized'
  })
  async changePassword(@Req() req, @Body() changePasswordDto: ChangePasswordDto): Promise<StandardResponse<any>> {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  @Post('verify-email')
  @ApiOperation({ 
    summary: 'Verify email',
    description: 'Verify user email address'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ 
    status: 200, 
    description: 'Email verified successfully'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized'
  })
  async verifyEmail(@Req() req): Promise<StandardResponse<any>> {
    return this.usersService.verifyEmail(req.user.id);
  }
}