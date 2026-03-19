import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Response } from "express";
import { createReadStream } from "fs";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiProduces,
} from "@nestjs/swagger";

import { OrdersService } from "./orders.service";
import { FulfillmentService } from "./fulfillment.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderQueryDto } from "./dto/order-query.dto";

@ApiTags("Orders")
@ApiBearerAuth("JWT-auth")
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly fulfillmentService: FulfillmentService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Get user orders",
    description: "Retrieve paginated list of orders for the authenticated user",
  })
  @ApiQuery({ type: OrderQueryDto })
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Orders retrieved successfully" },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              total_amount: { type: "number" },
              status: {
                type: "string",
                enum: [
                  "pending",
                  "confirmed",
                  "completed",
                  "cancelled",
                  "failed",
                ],
              },
              created_at: { type: "string", format: "date-time" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        price: { type: "number" },
                      },
                    },
                    quantity: { type: "number" },
                    unit_price: { type: "number" },
                    total_price: { type: "number" },
                  },
                },
              },
            },
          },
        },
        metadata: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            total: { type: "number" },
            pages: { type: "number" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getOrders(@Req() req: any, @Query() query: OrderQueryDto) {
    return this.ordersService.getOrders(req.user.id, query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get order details",
    description: "Retrieve detailed information about a specific order",
  })
  @ApiParam({ name: "id", description: "Order ID", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Order details retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Order retrieved successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            total_amount: { type: "number" },
            status: { type: "string" },
            payment_status: { type: "string" },
            fulfillment_status: { type: "string" },
            created_at: { type: "string", format: "date-time" },
            items: { type: "array" },
            download_links: { type: "array" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Order not found" })
  async getOrder(@Req() req: any, @Param("id") id: string) {
    return this.ordersService.getOrder(req.user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: "Create new order",
    description: "Create a new order from cart items or specified products",
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: "Order created successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Order created successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            total_amount: { type: "number" },
            status: { type: "string", example: "completed" },
            payment_status: { type: "string", example: "paid" },
            fulfillment_status: { type: "string", example: "fulfilled" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid items or insufficient balance",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createOrder(@Req() req: any, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.id, createOrderDto);
  }

  @Post(":id/cancel")
  @ApiOperation({
    summary: "Cancel order",
    description:
      "Cancel a pending order and process refund if payment was made",
  })
  @ApiParam({ name: "id", description: "Order ID", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Order cancelled successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Order cancelled successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            status: { type: "string", example: "cancelled" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Order cannot be cancelled" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Order not found" })
  async cancelOrder(@Req() req: any, @Param("id") id: string) {
    return this.ordersService.cancelOrder(req.user.id, id);
  }

  @Get(":id/download/:fileId")
  @ApiOperation({
    summary: "Download digital file",
    description: "Download a digital file from a completed order",
  })
  @ApiParam({ name: "id", description: "Order ID", format: "uuid" })
  @ApiParam({ name: "fileId", description: "Digital file ID", format: "uuid" })
  @ApiProduces("application/octet-stream")
  @ApiResponse({
    status: 200,
    description: "File download started",
    content: {
      "application/octet-stream": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Download link expired or limit exceeded",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Order or file not found" })
  async downloadFile(
    @Req() req: any,
    @Param("id") orderId: string,
    @Param("fileId") fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const downloadLinkResponse = await this.fulfillmentService.getDownloadLink(
      orderId,
      fileId,
      req.user.id,
    );

    if (!downloadLinkResponse.success) {
      throw new Error(downloadLinkResponse.message);
    }

    const downloadLink = downloadLinkResponse.data;
    const file = createReadStream(downloadLink.digital_file.file_path);

    res.set({
      "Content-Type": downloadLink.digital_file.mime_type,
      "Content-Disposition": `attachment; filename="${downloadLink.digital_file.original_name}"`,
    });

    return new StreamableFile(file);
  }
}
