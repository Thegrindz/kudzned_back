import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Product } from "../../database/entities/product.entity";
import { DigitalFile } from "../../database/entities/digital-file.entity";
import {
  ProductStatus,
  ProductAvailability,
} from "../../common/enums/product.enum";
import { UserRole } from "../../common/enums/user.enum";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { CloudinaryService } from "../../common/services/cloudinary.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(DigitalFile)
    private digitalFileRepository: Repository<DigitalFile>,
    private responseService: ResponseService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async findAll(query: ProductQueryDto): Promise<StandardResponse<any>> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category_id,
        min_price,
        max_price,
        tags,
        // status = ProductStatus.ACTIVE,
        sort_by = "created_at",
        sort_order = "DESC",
      } = query;

      const queryBuilder = this.productRepository
        .createQueryBuilder("product")
        .leftJoinAndSelect("product.category", "category")
        .leftJoinAndSelect("product.vendor", "vendor");
      // .where('product.status = :status', { status });

      if (search) {
        queryBuilder.andWhere(
          "(product.title ILIKE :search OR product.description ILIKE :search)",
          { search: `%${search}%` },
        );
      }

      if (category_id) {
        queryBuilder.andWhere("product.category_id = :category_id", {
          category_id,
        });
      }

      if (min_price) {
        queryBuilder.andWhere("product.price >= :min_price", { min_price });
      }

      if (max_price) {
        queryBuilder.andWhere("product.price <= :max_price", { max_price });
      }

      if (tags && tags.length > 0) {
        queryBuilder.andWhere("product.tags && :tags", { tags });
      }

      queryBuilder
        .orderBy(`product.${sort_by}`, sort_order as "ASC" | "DESC")
        .skip((page - 1) * limit)
        .take(limit);

      const [products, total] = await queryBuilder.getManyAndCount();

      return this.responseService.paginated(
        products,
        page,
        limit,
        total,
        "Products retrieved successfully",
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve products",
        { error: error.message },
      );
    }
  }

  async findById(id: string): Promise<StandardResponse<Product>> {
    try {
      const product = await this.productRepository.findOne({
        where: { id },
        relations: ["category", "vendor", "digital_files"],
      });

      if (!product) {
        return this.responseService.notFound("Product not found");
      }

      return this.responseService.success(
        "Product retrieved successfully",
        product,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve product",
        { error: error.message },
      );
    }
  }

  async findFeatured(limit = 10): Promise<StandardResponse<Product[]>> {
    try {
      const products = await this.productRepository.find({
        where: {
          status: ProductStatus.ACTIVE,
          availability: ProductAvailability.IN_STOCK,
        },
        relations: ["category", "vendor"],
        order: { total_sales: "DESC", rating: "DESC" },
        take: limit,
      });

      return this.responseService.success(
        "Featured products retrieved successfully",
        products,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve featured products",
        { error: error.message },
      );
    }
  }

  async create(
    vendorId: string,
    createProductDto: CreateProductDto,
    files?: {
      image?: Express.Multer.File[];
      additional_images?: Express.Multer.File[];
      digital_file?: Express.Multer.File[];
    },
  ): Promise<StandardResponse<Product>> {
    try {
      const { image, additional_images, digital_file, tags, ...productData } =
        createProductDto;

      // Process tags if provided
      let processedTags: string[] = [];
      if (tags) {
        if (typeof tags === "string") {
          processedTags = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
        } else if (Array.isArray(tags)) {
          processedTags = tags.filter(
            (tag) => typeof tag === "string" && tag.length > 0,
          );
        }
      }

      // Upload main image to Cloudinary
      let imageUrl: string | undefined;
      if (files?.image && files.image[0]) {
        try {
          const uploadResult = await this.cloudinaryService.uploadFile(
            files.image[0],
            "products/images",
          );
          imageUrl = uploadResult.secure_url;
        } catch (uploadError) {
          console.error("Main image upload error:", uploadError);
          return this.responseService.internalServerError(
            "Failed to upload main image",
            {
              error: uploadError.message,
            },
          );
        }
      }

      // Upload additional images to Cloudinary
      const additionalImageUrls: string[] = [];
      if (files?.additional_images && files.additional_images.length > 0) {
        try {
          for (const file of files.additional_images.slice(0, 5)) {
            // Max 5 additional images
            const uploadResult = await this.cloudinaryService.uploadFile(
              file,
              "products/images",
            );
            additionalImageUrls.push(uploadResult.secure_url);
          }
        } catch (uploadError) {
          console.error("Additional images upload error:", uploadError);
          return this.responseService.internalServerError(
            "Failed to upload additional images",
            {
              error: uploadError.message,
            },
          );
        }
      }

      // Combine all image URLs
      const allImages = [imageUrl, ...additionalImageUrls].filter(Boolean);

      // Create product
      const product = this.productRepository.create({
        ...productData,
        vendor_id: vendorId,
        images: allImages,
        tags: processedTags,
        status: productData.status || ProductStatus.ACTIVE,
        availability: productData.availability || ProductAvailability.IN_STOCK,
      });

      const savedProduct = await this.productRepository.save(product);

      // Handle digital file upload if provided
      if (files?.digital_file && files.digital_file[0]) {
        try {
          const digitalFileUpload = files.digital_file[0];

          // Upload digital file to Cloudinary (private folder)
          const uploadResult = await this.cloudinaryService.uploadFile(
            digitalFileUpload,
            "products/digital-files",
            { resource_type: "auto", access_mode: "authenticated" },
          );

          // Create digital file record
          const digitalFile = this.digitalFileRepository.create({
            product_id: savedProduct.id,
            filename: uploadResult.public_id,
            original_name: digitalFileUpload.originalname,
            file_path: uploadResult.secure_url,
            file_size: digitalFileUpload.size,
            mime_type: digitalFileUpload.mimetype,
          });

          await this.digitalFileRepository.save(digitalFile);
        } catch (uploadError) {
          console.error("Digital file upload error:", uploadError);
          return this.responseService.internalServerError(
            "Failed to upload digital file",
            {
              error: uploadError.message,
            },
          );
        }
      }

      // Fetch the complete product with relations
      const completeProduct = await this.productRepository.findOne({
        where: { id: savedProduct.id },
        relations: ["category", "digital_files"],
      });

      return this.responseService.created(
        "Product created successfully",
        completeProduct,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to create product",
        { error: error.message },
      );
    }
  }

  async update(
    id: string,
    userId: string,
    userRole: UserRole,
    updateProductDto: UpdateProductDto,
    files?: {
      image?: Express.Multer.File[];
      additional_images?: Express.Multer.File[];
      digital_file?: Express.Multer.File[];
    },
  ): Promise<StandardResponse<Product>> {
    try {
      const productResponse = await this.findById(id);
      if (!productResponse.success) {
        return productResponse;
      }

      const product = productResponse.data;

      // Check permissions
      if (userRole !== UserRole.ADMIN && product.vendor_id !== userId) {
        return this.responseService.forbidden(
          "You can only update your own products",
        );
      }

      const { image, additional_images, digital_file, tags, ...productData } =
        updateProductDto;

      // Filter out undefined values from productData
      const filteredProductData = Object.fromEntries(
        Object.entries(productData).filter(([_, v]) => v !== undefined),
      );

      // Process tags if provided
      let processedTags: string[] | undefined;
      if (tags !== undefined) {
        if (typeof tags === "string") {
          processedTags = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
        } else if (Array.isArray(tags)) {
          processedTags = tags.filter(
            (tag) => typeof tag === "string" && tag.length > 0,
          );
        }
      }

      // Handle image uploads
      let updatedImages = [...(product.images || [])];

      // Upload new main image if provided
      if (files?.image && files.image[0]) {
        try {
          const uploadResult = await this.cloudinaryService.uploadFile(
            files.image[0],
            "products/images",
          );
          // Replace the first image or add as first image
          if (updatedImages.length > 0) {
            updatedImages[0] = uploadResult.secure_url;
          } else {
            updatedImages.push(uploadResult.secure_url);
          }
        } catch (uploadError) {
          console.error("Main image update error:", uploadError);
          return this.responseService.internalServerError(
            "Failed to upload main image",
            {
              error: uploadError.message,
            },
          );
        }
      }

      // Upload additional images if provided
      if (files?.additional_images && files.additional_images.length > 0) {
        try {
          const newImageUrls: string[] = [];
          for (const file of files.additional_images.slice(0, 5)) {
            const uploadResult = await this.cloudinaryService.uploadFile(
              file,
              "products/images",
            );
            newImageUrls.push(uploadResult.secure_url);
          }
          // Add new images to existing ones (keep main image, add additional)
          updatedImages = [updatedImages[0], ...newImageUrls]
            .filter(Boolean)
            .slice(0, 6); // Max 6 total images
        } catch (uploadError) {
          console.error("Additional images update error:", uploadError);
          return this.responseService.internalServerError(
            "Failed to upload additional images",
            {
              error: uploadError.message,
            },
          );
        }
      }

      // Prepare update data
      const updateData: any = {
        ...filteredProductData,
        ...(processedTags && { tags: processedTags }),
        ...(updatedImages.length > 0 && { images: updatedImages }),
      };

      await this.productRepository.update(id, updateData);

      // Handle digital file upload if provided
      if (files?.digital_file && files.digital_file[0]) {
        try {
          const digitalFileUpload = files.digital_file[0];

          // Upload new digital file to Cloudinary
          const uploadResult = await this.cloudinaryService.uploadFile(
            digitalFileUpload,
            "products/digital-files",
            { resource_type: "auto", access_mode: "authenticated" },
          );

          // Remove old digital file(s) and create new one
          await this.digitalFileRepository.delete({ product_id: id });

          const digitalFile = this.digitalFileRepository.create({
            product_id: id,
            filename: uploadResult.public_id,
            original_name: digitalFileUpload.originalname,
            file_path: uploadResult.secure_url,
            file_size: digitalFileUpload.size,
            mime_type: digitalFileUpload.mimetype,
          });

          await this.digitalFileRepository.save(digitalFile);
        } catch (uploadError) {
          console.error("Digital file update error:", uploadError);
          return this.responseService.internalServerError(
            "Failed to upload digital file",
            {
              error: uploadError.message,
            },
          );
        }
      }

      const updatedProductResponse = await this.findById(id);

      if (updatedProductResponse.success) {
        return this.responseService.success(
          "Product updated successfully",
          updatedProductResponse.data,
        );
      }

      return updatedProductResponse;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to update product",
        { error: error.message },
      );
    }
  }

  async delete(
    id: string,
    userId: string,
    userRole: UserRole,
  ): Promise<StandardResponse<any>> {
    try {
      const productResponse = await this.findById(id);
      if (!productResponse.success) {
        return productResponse;
      }

      const product = productResponse.data;

      // Check permissions
      if (userRole !== UserRole.ADMIN && product.vendor_id !== userId) {
        return this.responseService.forbidden(
          "You can only delete your own products",
        );
      }

      await this.productRepository.delete(id);
      return this.responseService.success("Product deleted successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to delete product",
        { error: error.message },
      );
    }
  }

  async getVendorProducts(
    vendorId: string,
    query: ProductQueryDto,
  ): Promise<StandardResponse<any>> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        sort_by = "created_at",
        sort_order = "DESC",
      } = query;

      const queryBuilder = this.productRepository
        .createQueryBuilder("product")
        .leftJoinAndSelect("product.category", "category")
        .where("product.vendor_id = :vendorId", { vendorId });

      if (search) {
        queryBuilder.andWhere(
          "(product.title ILIKE :search OR product.description ILIKE :search)",
          { search: `%${search}%` },
        );
      }

      if (status) {
        queryBuilder.andWhere("product.status = :status", { status });
      }

      queryBuilder
        .orderBy(`product.${sort_by}`, sort_order as "ASC" | "DESC")
        .skip((page - 1) * limit)
        .take(limit);

      const [products, total] = await queryBuilder.getManyAndCount();

      return this.responseService.paginated(
        products,
        page,
        limit,
        total,
        "Vendor products retrieved successfully",
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve vendor products",
        { error: error.message },
      );
    }
  }

  async addDigitalFile(
    productId: string,
    fileData: {
      filename: string;
      original_name: string;
      file_path: string;
      file_size: number;
      mime_type: string;
    },
  ): Promise<StandardResponse<DigitalFile>> {
    try {
      const digitalFile = this.digitalFileRepository.create({
        product_id: productId,
        ...fileData,
      });

      const savedFile = await this.digitalFileRepository.save(digitalFile);
      return this.responseService.created(
        "Digital file added successfully",
        savedFile,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to add digital file",
        { error: error.message },
      );
    }
  }

  async removeDigitalFile(fileId: string): Promise<StandardResponse<any>> {
    try {
      await this.digitalFileRepository.delete(fileId);
      return this.responseService.success("Digital file removed successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to remove digital file",
        { error: error.message },
      );
    }
  }

  async incrementSales(productId: string): Promise<StandardResponse<any>> {
    try {
      await this.productRepository.increment(
        { id: productId },
        "total_sales",
        1,
      );
      return this.responseService.success(
        "Product sales incremented successfully",
        { success: true },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to increment product sales",
        { error: error.message },
      );
    }
  }
}
