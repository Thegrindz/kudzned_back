import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';

import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseService, StandardResponse } from '../../common/services/response.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly responseService: ResponseService,
  ) {}

  @Post('upload/product-image')
  @ApiOperation({ 
    summary: 'Upload product image',
    description: 'Upload a single product image (JPEG, PNG, GIF, WebP, max 5MB)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Image uploaded successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid file or validation error'
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProductImage(@UploadedFile() file: Express.Multer.File): Promise<StandardResponse<any>> {
    return this.mediaService.uploadFile(file, 'product');
  }

  @Post('upload/product-images')
  @ApiOperation({ 
    summary: 'Upload multiple product images',
    description: 'Upload multiple product images (max 10 files, JPEG, PNG, GIF, WebP, max 5MB each)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Images uploaded successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid files or validation error'
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadProductImages(@UploadedFiles() files: Express.Multer.File[]): Promise<StandardResponse<any[]>> {
    return this.mediaService.uploadMultipleFiles(files, 'product');
  }

  @Post('upload/digital-file')
  @ApiOperation({ 
    summary: 'Upload digital file',
    description: 'Upload a digital file for products (any file type, max 100MB)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Digital file uploaded successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid file or validation error'
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDigitalFile(@UploadedFile() file: Express.Multer.File): Promise<StandardResponse<any>> {
    return this.mediaService.uploadFile(file, 'digital-file');
  }

  @Post('upload/avatar')
  @ApiOperation({ 
    summary: 'Upload user avatar',
    description: 'Upload user avatar image (JPEG, PNG, GIF, WebP, max 2MB)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Avatar uploaded successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid file or validation error'
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File): Promise<StandardResponse<any>> {
    return this.mediaService.uploadFile(file, 'avatar');
  }

  @Delete(':publicId')
  @ApiOperation({ 
    summary: 'Delete file',
    description: 'Delete a file from Cloudinary using its public ID'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ 
    status: 200, 
    description: 'File deleted successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'File not found'
  })
  @UseGuards(JwtAuthGuard)
  async deleteFile(@Param('publicId') publicId: string): Promise<StandardResponse<any>> {
    return this.mediaService.deleteFile(publicId);
  }

  @Get(':publicId/info')
  @ApiOperation({ 
    summary: 'Get file info',
    description: 'Get file information from Cloudinary'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ 
    status: 200, 
    description: 'File info retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'File not found'
  })
  @UseGuards(JwtAuthGuard)
  async getFileInfo(@Param('publicId') publicId: string): Promise<StandardResponse<any>> {
    return this.mediaService.getFileInfo(publicId);
  }
}