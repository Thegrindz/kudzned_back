import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { VouchesService } from './vouches.service';
import { CreateVouchDto } from './dto/create-vouch.dto';
import { UpdateVouchDto } from './dto/update-vouch.dto';
import { VouchQueryDto } from './dto/vouch-query.dto';
import { VouchHelpfulnessDto } from './dto/vouch-helpfulness.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user.enum';
import { VouchStatus } from '../../database/entities/vouch.entity';
import { StandardResponse } from '../../common/services/response.service';


@ApiTags('Vouches')
@Controller('vouches')
export class VouchesController {
  constructor(private readonly vouchesService: VouchesService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('proof_image'))
  @ApiOperation({ 
    summary: 'Create a new vouch',
    description: 'Create a vouch/review for a product. Requires authentication.' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Vouch created successfully',
    type: StandardResponse,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Already vouched for this product' })
  async create(
    @Req() req: any,
    @Body() createVouchDto: CreateVouchDto,
    @UploadedFile() proofImage?: Express.Multer.File,
  ) {
    return this.vouchesService.create(req.user.id, createVouchDto, proofImage);
  }

  @Get('all')
  @ApiOperation({ 
    summary: 'Get all vouches',
    description: 'Retrieve vouches with optional filtering and pagination' 
  })
  @ApiResponse({
    status: 200,
    description: 'Vouches retrieved successfully',
    type: StandardResponse,
  })
  async findAll(@Query() query: VouchQueryDto) {
    return this.vouchesService.findAll(query);
  }

  @Get('product/:productId/stats')
  @ApiOperation({ 
    summary: 'Get product vouch statistics',
    description: 'Get rating statistics and vouch counts for a specific product' 
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  async getProductStats(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.vouchesService.getProductStats(productId);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get vouch by ID',
    description: 'Retrieve a specific vouch by its ID' 
  })
  @ApiParam({ name: 'id', description: 'Vouch UUID' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchesService.findById(id);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('proof_image'))
  @ApiOperation({ 
    summary: 'Update a vouch',
    description: 'Update your own vouch. Requires authentication.' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Vouch UUID' })

  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() updateVouchDto: UpdateVouchDto,
    @UploadedFile() proofImage?: Express.Multer.File,
  ) {
    return this.vouchesService.update(id, req.user.id, updateVouchDto, proofImage);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Delete a vouch',
    description: 'Delete your own vouch. Requires authentication.' 
  })
  async delete(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.vouchesService.delete(id, req.user.id);
  }

  @Post(':id/helpfulness')
  @ApiOperation({ 
    summary: 'Vote on vouch helpfulness',
    description: 'Vote whether a vouch is helpful or not. Requires authentication.' 
  })
  @ApiParam({ name: 'id', description: 'Vouch UUID' })
  async voteHelpfulness(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() vouchHelpfulnessDto: VouchHelpfulnessDto,
  ) {
    return this.vouchesService.voteHelpfulness(id, req.user.id, vouchHelpfulnessDto);
  }

  // Admin routes
  @Put(':id/moderate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Moderate a vouch (Admin only)',
    description: 'Approve, reject, or flag a vouch. Admin access required.' 
  })
  @ApiParam({ name: 'id', description: 'Vouch UUID' })
  async moderateVouch(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status: VouchStatus,
    @Query('reason') reason?: string,
  ) {
    return this.vouchesService.moderateVouch(id, status, reason);
  }
}