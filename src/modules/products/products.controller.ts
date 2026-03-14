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
  UploadedFiles,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiBody, 
  ApiParam, 
  ApiQuery,
  ApiConsumes 
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import { ProductsService } from './products.service';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user.enum';
import { ResponseService, StandardResponse } from '../../common/services/response.service';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ProductResponseDto, ProductListResponseDto, CategoryResponseDto } from './dto/product-response.dto';



@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoryService: CategoryService,
    private readonly responseService: ResponseService,
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get products',
    description: 'Get paginated list of products with optional filtering'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Products retrieved successfully'
  })
  async getProducts(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ 
    summary: 'Get featured products',
    description: 'Get list of featured products'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of products to return' })
  @ApiResponse({ 
    status: 200, 
    description: 'Featured products retrieved successfully'
  })
  async getFeaturedProducts(@Query('limit') limit?: number) {
    return this.productsService.findFeatured(limit);
  }

  @Get('categories')
  @ApiOperation({ 
    summary: 'Get categories',
    description: 'Get all product categories'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Categories retrieved successfully'
  })
  async getCategories() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get product details',
    description: 'Get detailed information about a specific product'
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Product details retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Product not found'
  })
  async getProduct(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  // ADMIN ONLY ROUTES - Product Management
  @Get('admin/all')
  @ApiOperation({ 
    summary: 'Get all products (Admin)',
    description: 'Get all products for admin management (includes inactive products)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ type: ProductQueryDto })
  @ApiResponse({ 
    status: 200, 
    description: 'All products retrieved successfully'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin access required'
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllProductsForAdmin(@Query() query: ProductQueryDto) {
    // Admin can see all products regardless of status
    return this.productsService.findAll({ ...query, status: undefined });
  }

  // ADMIN ONLY ROUTES - Product Management
  @Post()
  @ApiOperation({ 
    summary: 'Create product',
    description: 'Create a new product with image and digital file uploads (admins only)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Product creation with file uploads',
    type: CreateProductDto,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Amazing Digital Product' },
        description: { type: 'string', example: 'A comprehensive guide...' },
        category_id: { type: 'string', format: 'uuid' },
        price: { type: 'number', example: 50000 },
        tags: { type: 'string', example: 'ebook,marketing,digital' },
        status: { type: 'string', enum: ['active', 'inactive', 'draft'] },
        availability: { type: 'string', enum: ['in_stock', 'out_of_stock'] },
        image: { type: 'string', format: 'binary', description: 'Main product image' },
        additional_images: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'Additional product images (max 5)'
        },
        digital_file: { type: 'string', format: 'binary', description: 'Digital file for delivery' }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Product created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Product created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            images: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string' },
            availability: { type: 'string' },
            category: { type: 'object' },
            digital_files: { type: 'array' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin access required'
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'additional_images', maxCount: 5 },
    { name: 'digital_file', maxCount: 1 }
  ]))
  async createProduct(
    @Req() req: any, 
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: { 
      image?: Express.Multer.File[], 
      additional_images?: Express.Multer.File[], 
      digital_file?: Express.Multer.File[] 
    }
  ) {
    return this.productsService.create(req.user.id, createProductDto, files);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update product',
    description: 'Update an existing product with optional file uploads (admins only)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({
    description: 'Product update with optional file uploads',
    type: UpdateProductDto,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Updated Product Title' },
        description: { type: 'string', example: 'Updated description...' },
        category_id: { type: 'string', format: 'uuid' },
        price: { type: 'number', example: 60000 },
        tags: { type: 'string', example: 'updated,tags,here' },
        status: { type: 'string', enum: ['active', 'inactive', 'draft'] },
        availability: { type: 'string', enum: ['in_stock', 'out_of_stock'] },
        image: { type: 'string', format: 'binary', description: 'New main product image' },
        additional_images: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'New additional product images (max 5)'
        },
        digital_file: { type: 'string', format: 'binary', description: 'New digital file' }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Product updated successfully'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Product not found'
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'additional_images', maxCount: 5 },
    { name: 'digital_file', maxCount: 1 }
  ]))
  async updateProduct(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles() files: { 
      image?: Express.Multer.File[], 
      additional_images?: Express.Multer.File[], 
      digital_file?: Express.Multer.File[] 
    }
  ) {
    return this.productsService.update(id, req.user.id, req.user.role, updateProductDto, files);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete product',
    description: 'Delete a product (admins only)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Product deleted successfully'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Product not found'
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteProduct(@Param('id') id: string, @Req() req: any) {
    return this.productsService.delete(id, req.user.id, req.user.role);
  }

  // ADMIN ONLY ROUTES - Category Management
  @Post('categories')
  @ApiOperation({ 
    summary: 'Create category',
    description: 'Create a new product category (admins only)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Category created successfully'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin access required'
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Put('categories/:id')
  @ApiOperation({ 
    summary: 'Update category',
    description: 'Update an existing category (admins only)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Category updated successfully'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Category not found'
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete('categories/:id')
  @ApiOperation({ 
    summary: 'Delete category',
    description: 'Delete a category (admins only)'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Category deleted successfully'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Category not found'
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteCategory(@Param('id') id: string) {
    return this.categoryService.delete(id);
  }
}