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
  ParseUUIDPipe,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";

import { CashoutClipsService } from "./cashout-clips.service";
import { CreateCashoutClipDto } from "./dto/create-cashout-clip.dto";
import { UpdateCashoutClipDto } from "./dto/update-cashout-clip.dto";
import { CashoutClipQueryDto } from "./dto/cashout-clip-query.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user.enum";
import { CashoutClipStatus } from "../../database/entities/cashout-clip.entity";
import { StandardResponse } from "../../common/services/response.service";

@ApiTags("Cashout Clips")
@Controller("cashout-clips")
export class CashoutClipsController {
  constructor(private readonly cashoutClipsService: CashoutClipsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary: "Create a new cashout clip",
    description:
      "Upload a video showing successful cashout from a product. Requires authentication.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: 201,
    description: "Cashout clip created successfully",
    type: StandardResponse,
  })
  async create(
    @Req() req: any,
    @Body() createCashoutClipDto: CreateCashoutClipDto,
    @UploadedFiles()
    files?: {
      video?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
  ) {
    return this.cashoutClipsService.create(
      req.user.id,
      createCashoutClipDto,
      files,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Get all cashout clips",
    description:
      "Retrieve cashout clips with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Cashout clips retrieved successfully",
    type: StandardResponse,
  })
  async findAll(@Query() query: CashoutClipQueryDto) {
    return this.cashoutClipsService.findAll(query);
  }

  @Get("featured")
  @ApiOperation({
    summary: "Get featured cashout clips",
    description: "Retrieve featured cashout clips",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Number of clips to return (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Featured clips retrieved successfully",
    type: StandardResponse,
  })
  async getFeatured(@Query("limit") limit?: number) {
    return this.cashoutClipsService.getFeatured(limit);
  }

  @Get("product/:productId")
  @ApiOperation({
    summary: "Get cashout clips for a product",
    description: "Retrieve cashout clips for a specific product",
  })
  @ApiParam({ name: "productId", description: "Product UUID" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Number of clips to return (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Product clips retrieved successfully",
    type: StandardResponse,
  })
  async getProductClips(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Query("limit") limit?: number,
  ) {
    return this.cashoutClipsService.getProductClips(productId, limit);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get cashout clip by ID",
    description: "Retrieve a specific cashout clip by its ID",
  })
  @ApiParam({ name: "id", description: "Cashout clip UUID" })
  @ApiResponse({
    status: 200,
    description: "Cashout clip retrieved successfully",
    type: StandardResponse,
  })
  @ApiResponse({ status: 404, description: "Cashout clip not found" })
  async findById(@Param("id", ParseUUIDPipe) id: string) {
    return this.cashoutClipsService.findById(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary: "Update a cashout clip",
    description: "Update your own cashout clip. Requires authentication.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", description: "Cashout clip UUID" })
  @ApiResponse({
    status: 200,
    description: "Cashout clip updated successfully",
    type: StandardResponse,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Can only update own clips" })
  @ApiResponse({ status: 404, description: "Cashout clip not found" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() updateCashoutClipDto: UpdateCashoutClipDto,
    @UploadedFiles()
    files?: {
      video?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
  ) {
    return this.cashoutClipsService.update(
      id,
      req.user.id,
      updateCashoutClipDto,
      files,
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Delete a cashout clip",
    description: "Delete your own cashout clip. Requires authentication.",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", description: "Cashout clip UUID" })
  @ApiResponse({
    status: 200,
    description: "Cashout clip deleted successfully",
    type: StandardResponse,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Can only delete own clips" })
  @ApiResponse({ status: 404, description: "Cashout clip not found" })
  async delete(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.cashoutClipsService.delete(id, req.user.id);
  }

  @Post(":id/view")
  @ApiOperation({
    summary: "Increment view count",
    description: "Increment the view count for a cashout clip",
  })
  @ApiParam({ name: "id", description: "Cashout clip UUID" })
  @ApiResponse({
    status: 200,
    description: "Views incremented successfully",
    type: StandardResponse,
  })
  @ApiResponse({ status: 404, description: "Cashout clip not found" })
  async incrementViews(@Param("id", ParseUUIDPipe) id: string) {
    return this.cashoutClipsService.incrementViews(id);
  }

  @Post(":id/like")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Toggle like on cashout clip",
    description: "Like or unlike a cashout clip. Requires authentication.",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", description: "Cashout clip UUID" })
  @ApiResponse({
    status: 200,
    description: "Like toggled successfully",
    type: StandardResponse,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Cashout clip not found" })
  async toggleLike(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.cashoutClipsService.toggleLike(id, req.user.id);
  }

  // Admin routes
  @Put(":id/moderate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Moderate a cashout clip (Admin only)",
    description:
      "Approve, reject, or flag a cashout clip. Admin access required.",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", description: "Cashout clip UUID" })
  @ApiQuery({
    name: "status",
    enum: CashoutClipStatus,
    description: "New status for the clip",
  })
  @ApiQuery({
    name: "reason",
    required: false,
    description: "Rejection reason (if rejecting)",
  })
  @ApiResponse({
    status: 200,
    description: "Cashout clip moderated successfully",
    type: StandardResponse,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Admin access required" })
  @ApiResponse({ status: 404, description: "Cashout clip not found" })
  async moderateClip(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("status") status: CashoutClipStatus,
    @Query("reason") reason?: string,
  ) {
    return this.cashoutClipsService.moderateClip(id, status, reason);
  }

  @Put(":id/featured")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Toggle featured status (Admin only)",
    description:
      "Toggle the featured status of a cashout clip. Admin access required.",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", description: "Cashout clip UUID" })
  @ApiResponse({
    status: 200,
    description: "Featured status toggled successfully",
    type: StandardResponse,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Admin access required" })
  @ApiResponse({ status: 404, description: "Cashout clip not found" })
  async toggleFeatured(@Param("id", ParseUUIDPipe) id: string) {
    return this.cashoutClipsService.toggleFeatured(id);
  }
}
