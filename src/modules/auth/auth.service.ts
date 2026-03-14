import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';

import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user.enum';
import { UsersService } from '../users/users.service';
import { ResponseService, StandardResponse } from '../../common/services/response.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TwoFADto } from './dto/two-fa.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private responseService: ResponseService,
  ) {}

  async register(registerDto: RegisterDto): Promise<StandardResponse<any>> {
    try {
      const { email, password, username, first_name, last_name, phone_number, role } = registerDto;

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: [{ email }, { username }],
      });

      if (existingUser) {
        return this.responseService.badRequest('User with this email or username already exists');
      }

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user with specified role (defaults to CUSTOMER)
      const user = this.userRepository.create({
        email,
        password_hash,
        username,
        first_name,
        last_name,
        phone_number,
        role: role || UserRole.CUSTOMER,
      });

      const savedUser = await this.userRepository.save(user);

      // Create wallet for user (only for customers and vendors, not admins)
      if (savedUser.role !== UserRole.ADMIN) {
        await this.usersService.createWalletForUser(savedUser.id);
      }

      // Generate JWT token
      const payload = { sub: savedUser.id, email: savedUser.email, role: savedUser.role };
      const access_token = this.jwtService.sign(payload);

      const userData = {
        access_token,
        user: {
          id: savedUser.id,
          email: savedUser.email,
          username: savedUser.username,
          first_name: savedUser.first_name,
          last_name: savedUser.last_name,
          role: savedUser.role,
          kyc_status: savedUser.kyc_status,
          two_factor_enabled: savedUser.two_factor_enabled,
        },
      };

      return this.responseService.created('User registered successfully', userData);
    } catch (error) {
      return this.responseService.internalServerError('Failed to register user', { error: error.message });
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { email } });
    
    if (user && await bcrypt.compare(password, user.password_hash)) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<StandardResponse<any>> {
    try {
      const { email, password } = loginDto;
      
      const user = await this.validateUser(email, password);
      if (!user) {
        return this.responseService.unauthorized('Invalid credentials');
      }

      // Update last login
      await this.userRepository.update(user.id, { last_login_at: new Date() });

      const payload = { sub: user.id, email: user.email, role: user.role };
      const access_token = this.jwtService.sign(payload);

      const userData = {
        access_token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          kyc_status: user.kyc_status,
          two_factor_enabled: user.two_factor_enabled,
        },
      };

      return this.responseService.success('Login successful', userData);
    } catch (error) {
      return this.responseService.internalServerError('Login failed', { error: error.message });
    }
  }

  async verify2FA(userId: string, twoFADto: TwoFADto): Promise<StandardResponse<any>> {
    try {
      const { token } = twoFADto;
      
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
        return this.responseService.badRequest('2FA not enabled for this user');
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (!verified) {
        return this.responseService.unauthorized('Invalid 2FA token');
      }

      return this.responseService.success('2FA verification successful', { verified: true });
    } catch (error) {
      return this.responseService.internalServerError('2FA verification failed', { error: error.message });
    }
  }

  async enable2FA(userId: string): Promise<StandardResponse<any>> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return this.responseService.notFound('User not found');
      }

      if (user.two_factor_enabled) {
        return this.responseService.badRequest('2FA is already enabled');
      }

      const secret = speakeasy.generateSecret({
        name: `KUDZNED (${user.email})`,
        issuer: 'KUDZNED',
      });

      await this.userRepository.update(userId, {
        two_factor_secret: secret.base32,
        two_factor_enabled: true,
      });

      const setupData = {
        secret: secret.base32,
        qr_code: secret.otpauth_url,
      };

      return this.responseService.success('2FA enabled successfully', setupData);
    } catch (error) {
      return this.responseService.internalServerError('Failed to enable 2FA', { error: error.message });
    }
  }

  async disable2FA(userId: string): Promise<StandardResponse<any>> {
    try {
      await this.userRepository.update(userId, {
        two_factor_secret: null,
        two_factor_enabled: false,
      });

      return this.responseService.success('2FA disabled successfully', { success: true });
    } catch (error) {
      return this.responseService.internalServerError('Failed to disable 2FA', { error: error.message });
    }
  }

  async refreshToken(userId: string): Promise<StandardResponse<any>> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return this.responseService.unauthorized('User not found');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      const access_token = this.jwtService.sign(payload);

      return this.responseService.success('Token refreshed successfully', { access_token });
    } catch (error) {
      return this.responseService.internalServerError('Failed to refresh token', { error: error.message });
    }
  }
}