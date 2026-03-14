import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    // Try both direct env vars and nested config
    let cloudName =
      this.configService.get<string>("cloudinary.cloudName") ||
      this.configService.get<string>("CLOUDINARY_CLOUD_NAME");
    let apiKey =
      this.configService.get<string>("cloudinary.apiKey") ||
      this.configService.get<string>("CLOUDINARY_API_KEY");
    let apiSecret =
      this.configService.get<string>("cloudinary.apiSecret") ||
      this.configService.get<string>("CLOUDINARY_API_SECRET");

    // Fallback to direct process.env if ConfigService fails
    if (!cloudName) cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!apiKey) apiKey = process.env.CLOUDINARY_API_KEY;
    if (!apiSecret) apiSecret = process.env.CLOUDINARY_API_SECRET;

    // Temporary hardcoded fallback for testing (REMOVE AFTER TESTING)
    if (!cloudName) cloudName = "dma3njgsr";
    if (!apiKey) apiKey = "534271197746458";
    if (!apiSecret) apiSecret = "Me-jcDL16MSmVl3yw5NJoRfuwYE";

    console.log("Cloudinary Config:", {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret ? "***" : undefined,
    });

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("Missing Cloudinary config. Available env vars:", {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
          ? "***"
          : undefined,
      });
      throw new Error(
        "Cloudinary configuration is missing. Please check your environment variables.",
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = "kudzned",
    options: any = {},
  ): Promise<any> {
    try {
      if (!file) {
        throw new Error("No file provided");
      }

      if (!file.buffer) {
        throw new Error("File buffer is missing");
      }

      if (!file.mimetype) {
        throw new Error("File mimetype is missing");
      }

      // Auto-detect video from mimetype in addition to explicit option
      const isVideo =
        options.resource_type === "video" || file.mimetype.startsWith("video/");

      // Check file size limits
      const maxSizeInMB = isVideo ? 100 : 10; // 100MB for videos, 10MB for images
      const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        throw new Error(
          `File too large. Maximum size is ${maxSizeInMB}MB, but file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        );
      }

      console.log("Uploading file:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        folder,
      });

      // Check if Cloudinary is configured
      const config = cloudinary.config();
      if (!config.cloud_name || !config.api_key || !config.api_secret) {
        throw new Error(
          "Cloudinary is not properly configured. Missing cloud_name, api_key, or api_secret.",
        );
      }

      const uploadOptions: any = {
        folder,
        resource_type: isVideo ? "video" : "auto",
        ...options,
      };

      if (isVideo) {
        uploadOptions.chunk_size = 20000000; // 20MB chunks for videos (Cloudinary min is 5MB)
      } else {
        uploadOptions.timeout = 120000; // 2 min for images
      }

      console.log("Cloudinary config check:", {
        cloud_name: config.cloud_name,
        api_key: config.api_key,
        has_secret: !!config.api_secret,
      });

      let result;
      let tempFilePath;

      if (isVideo) {
        // For videos, memory streams often cause HTTP 499 Request Timeout due to
        // Cloudinary's ingress proxies halting streams while transcoding.
        // Saving to a temp file allows Cloudinary sdk to compute concrete Content-Length
        // and upload much more reliably.
        tempFilePath = path.join(
          os.tmpdir(),
          `${uuidv4()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`,
        );

        await new Promise<void>((resolve, reject) => {
          fs.writeFile(tempFilePath, file.buffer, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        try {
          result = await new Promise<any>((resolve, reject) => {
            cloudinary.uploader.upload_large(
              tempFilePath,
              uploadOptions,
              (error, res) => {
                if (error) return reject(error);
                resolve(res);
              },
            );
          });
        } finally {
          // Clean up temp file
          fs.unlink(tempFilePath, () => {});
        }
      } else {
        // Images are fine with standard streams
        result = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, res) => {
              if (error) return reject(error);
              resolve(res);
            },
          );
          const readable = Readable.from(file.buffer);
          readable.on("error", reject);
          readable.pipe(uploadStream);
        });
      }

      console.log("Upload successful:", {
        public_id: result.public_id,
        secure_url: result.secure_url,
      });

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        resource_type: result.resource_type,
        bytes: result.bytes,
        created_at: result.created_at,
      };
    } catch (error) {
      console.error("Cloudinary upload error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        http_code: error.http_code,
        error: error.error,
        file: file
          ? {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            }
          : "No file provided",
      });

      // Provide more specific error messages
      if (error.error && error.error.name === "TimeoutError") {
        throw new Error(
          `Upload timeout - file too large or slow connection. File size: ${file.size} bytes`,
        );
      } else if (error.message && error.message.includes("Invalid API Key")) {
        throw new Error("Invalid Cloudinary API Key");
      } else if (
        error.message &&
        error.message.includes("Invalid cloud name")
      ) {
        throw new Error("Invalid Cloudinary cloud name");
      } else if (error.http_code === 401) {
        throw new Error(
          "Cloudinary authentication failed - check your credentials",
        );
      } else if (error.http_code === 400) {
        throw new Error(
          `Cloudinary bad request: ${error.message || "Invalid request"}`,
        );
      } else if (error.http_code === 413) {
        throw new Error("File too large for Cloudinary upload");
      } else {
        throw new Error(
          `Failed to upload file to Cloudinary: ${error.message || error.error?.message || "Unknown error"}`,
        );
      }
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = "kudzned",
    options: any = {},
  ): Promise<any[]> {
    try {
      if (!files || files.length === 0) {
        throw new Error("No files provided");
      }

      const uploadPromises = files.map((file) =>
        this.uploadFile(file, folder, options),
      );

      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      throw new Error(`Failed to upload files to Cloudinary: ${error.message}`);
    }
  }

  private async uploadSingleFile(
    file: Express.Multer.File,
    folder: string,
    options: any,
  ): Promise<any> {
    return this.uploadFile(file, folder, options);
  }

  async deleteFile(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result === "ok") {
        return result;
      } else {
        throw new Error("Failed to delete file");
      }
    } catch (error) {
      throw new Error(
        `Failed to delete file from Cloudinary: ${error.message}`,
      );
    }
  }

  async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        resource_type: result.resource_type,
        bytes: result.bytes,
        created_at: result.created_at,
      };
    } catch (error) {
      throw new Error("File not found in Cloudinary");
    }
  }

  generateTransformationUrl(
    publicId: string,
    transformations: any = {},
  ): string {
    return cloudinary.url(publicId, {
      secure: true,
      ...transformations,
    });
  }

  // Test method to verify configuration
  testConfiguration(): any {
    const cloudName =
      this.configService.get<string>("cloudinary.cloudName") ||
      this.configService.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey =
      this.configService.get<string>("cloudinary.apiKey") ||
      this.configService.get<string>("CLOUDINARY_API_KEY");
    const apiSecret =
      this.configService.get<string>("cloudinary.apiSecret") ||
      this.configService.get<string>("CLOUDINARY_API_SECRET");

    return {
      configured: !!(cloudName && apiKey && apiSecret),
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret ? "***" : undefined,
      direct_env: {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
          ? "***"
          : undefined,
      },
    };
  }

  // Helper method to validate file types
  validateFileType(file: Express.Multer.File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.mimetype);
  }

  // Helper method to validate file size
  validateFileSize(file: Express.Multer.File, maxSizeInMB: number): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }
}
