import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";

import { CartService } from "./cart.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@ApiTags("Cart")
@ApiBearerAuth("JWT-auth")
@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: "Get user cart",
    description: "Retrieve the current user's shopping cart with all items",
  })
  @ApiResponse({
    status: 200,
    description: "Cart retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Cart retrieved successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            total_amount: { type: "number", example: 25000 },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  quantity: { type: "number", example: 2 },
                  unit_price: { type: "number", example: 10000 },
                  total_price: { type: "number", example: 20000 },
                  product: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      title: { type: "string", example: "Digital Product" },
                      price: { type: "number", example: 10000 },
                      image_url: {
                        type: "string",
                        example: "https://example.com/image.jpg",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getCart(@Req() req: any) {
    return this.cartService.getOrCreateCart(req.user.id);
  }

  @Post("items")
  @ApiOperation({
    summary: "Add item to cart",
    description:
      "Add a product to the user's shopping cart or update quantity if already exists",
  })
  @ApiBody({ type: AddToCartDto })
  @ApiResponse({
    status: 200,
    description: "Item added to cart successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Item added to cart successfully" },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            total_amount: { type: "number" },
            items: { type: "array" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request - Invalid product ID" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Product not found" })
  async addToCart(@Req() req: any, @Body() addToCartDto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, addToCartDto);
  }

  @Put("items/:id")
  @ApiOperation({
    summary: "Update cart item quantity",
    description:
      "Update the quantity of a specific item in the cart (set to 0 to remove)",
  })
  @ApiParam({ name: "id", description: "Cart item ID", format: "uuid" })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({
    status: 200,
    description: "Cart item quantity updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Cart item quantity updated successfully",
        },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            total_amount: { type: "number" },
            items: { type: "array" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Cart item not found" })
  async updateCartItem(
    @Req() req: any,
    @Param("id") itemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItemQuantity(
      req.user.id,
      itemId,
      updateCartItemDto.quantity,
    );
  }

  @Delete("items/:id")
  @ApiOperation({
    summary: "Remove item from cart",
    description: "Remove a specific item from the user's shopping cart",
  })
  @ApiParam({ name: "id", description: "Cart item ID", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Item removed from cart successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Item removed from cart successfully",
        },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            total_amount: { type: "number" },
            items: { type: "array" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Cart item not found" })
  async removeFromCart(@Req() req: any, @Param("id") itemId: string) {
    return this.cartService.removeFromCart(req.user.id, itemId);
  }

  @Delete()
  @ApiOperation({
    summary: "Clear cart",
    description: "Remove all items from the user's shopping cart",
  })
  @ApiResponse({
    status: 200,
    description: "Cart cleared successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Cart cleared successfully" },
        data: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async clearCart(@Req() req: any) {
    return this.cartService.clearCart(req.user.id);
  }
}
