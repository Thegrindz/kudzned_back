import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudinaryService } from "../../common/services/cloudinary.service";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";

@Injectable()
export class MediaService {
  constructor(
    private configService: ConfigService,
    private cloudinaryService: CloudinaryService,
    private responseService: ResponseService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    type: "product" | "digital-file" | "avatar" = "product",
  ): Promise<StandardResponse<any>> {
    try {
      if (!file) {
        return this.responseService.badRequest("No file provided");
      }

      // Validate file based on type
      const validation = this.validateFile(file, type);
      if (!validation.isValid) {
        return this.responseService.badRequest(validation.message);
      }

      // Upload to Cloudinary
      const folder = this.getCloudinaryFolder(type);
      const options = this.getUploadOptions(type);

      const uploadResult = await this.cloudinaryService.uploadFile(
        file,
        folder,
        options,
      );

      // Return formatted response
      return this.responseService.success("File uploaded successfully", {
        filename: uploadResult.public_id,
        original_name: file.originalname,
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        file_size: uploadResult.bytes,
        mime_type: file.mimetype,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        created_at: uploadResult.created_at,
      });
    } catch (error) {
      return this.responseService.internalServerError("Failed to upload file", {
        error: error.message,
      });
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    type: "product" | "digital-file" | "avatar" = "product",
  ): Promise<StandardResponse<any[]>> {
    try {
      if (!files || files.length === 0) {
        return this.responseService.badRequest("No files provided");
      }

      // Validate all files
      for (const file of files) {
        const validation = this.validateFile(file, type);
        if (!validation.isValid) {
          return this.responseService.badRequest(
            `File ${file.originalname}: ${validation.message}`,
          );
        }
      }

      // Upload to Cloudinary
      const folder = this.getCloudinaryFolder(type);
      const options = this.getUploadOptions(type);

      const uploadResults = await this.cloudinaryService.uploadMultipleFiles(
        files,
        folder,
        options,
      );

      // Format response
      const formattedResults = uploadResults.map((result, index) => ({
        filename: result.public_id,
        original_name: files[index].originalname,
        url: result.secure_url,
        public_id: result.public_id,
        file_size: result.bytes,
        mime_type: files[index].mimetype,
        width: result.width,
        height: result.height,
        format: result.format,
        created_at: result.created_at,
      }));

      return this.responseService.success(
        `${formattedResults.length} files uploaded successfully`,
        formattedResults,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to upload files",
        { error: error.message },
      );
    }
  }

  async deleteFile(publicId: string): Promise<StandardResponse<any>> {
    try {
      const result = await this.cloudinaryService.deleteFile(publicId);
      return this.responseService.success("File deleted successfully", result);
    } catch (error) {
      return this.responseService.internalServerError("Failed to delete file", {
        error: error.message,
      });
    }
  }

  async getFileInfo(publicId: string): Promise<StandardResponse<any>> {
    try {
      const result = await this.cloudinaryService.getFileInfo(publicId);
      return this.responseService.success(
        "File info retrieved successfully",
        result,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to get file info",
        { error: error.message },
      );
    }
  }

  generateTransformationUrl(
    publicId: string,
    transformations: any = {},
  ): string {
    return this.cloudinaryService.generateTransformationUrl(
      publicId,
      transformations,
    );
  }

  private validateFile(
    file: Express.Multer.File,
    type: "product" | "digital-file" | "avatar",
  ): { isValid: boolean; message?: string } {
    // File size validation
    const maxSizes = {
      product: 5, // 5MB for product images
      avatar: 2, // 2MB for avatars
      "digital-file": 100, // 100MB for digital files
    };

    if (!this.cloudinaryService.validateFileSize(file, maxSizes[type])) {
      return {
        isValid: false,
        message: `File size exceeds ${maxSizes[type]}MB limit`,
      };
    }

    // File type validation
    const allowedTypes = {
      product: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      avatar: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      "digital-file": [
        // Images
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        // Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
        // Archives
        "application/zip",
        "application/x-rar-compressed",
        "application/x-7z-compressed",
        // Audio
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        // Video
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "video/x-msvideo",
        // Code files
        "text/javascript",
        "text/css",
        "text/html",
        "application/json",
      ],
    };

    if (!this.cloudinaryService.validateFileType(file, allowedTypes[type])) {
      return {
        isValid: false,
        message: `File type ${file.mimetype} is not allowed for ${type}`,
      };
    }

    return { isValid: true };
  }

  private getCloudinaryFolder(type: string): string {
    const folders = {
      product: "kudzned/products",
      avatar: "kudzned/avatars",
      "digital-file": "kudzned/digital-files",
    };
    return folders[type] || "kudzned/misc";
  }

  private getUploadOptions(type: string): any {
    const baseOptions = {
      resource_type: "auto",
      use_filename: true,
      unique_filename: true,
    };

    switch (type) {
      case "product":
      case "avatar":
        return {
          ...baseOptions,
          transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
        };
      case "digital-file":
        return {
          ...baseOptions,
          resource_type: "auto",
        };
      default:
        return baseOptions;
    }
  }
}
