import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Cart } from "../../database/entities/cart.entity";
import { CartItem } from "../../database/entities/cart-item.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { ProductsService } from "../products/products.service";
import { AddToCartDto } from "./dto/add-to-cart.dto";

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    private productsService: ProductsService,
    private responseService: ResponseService,
  ) {}

  async getOrCreateCart(userId: string): Promise<StandardResponse<Cart>> {
    try {
      let cart = await this.cartRepository.findOne({
        where: { user_id: userId },
        relations: ["items", "items.product"],
      });

      if (!cart) {
        cart = this.cartRepository.create({
          user_id: userId,
          total_amount: 0,
        });
        cart = await this.cartRepository.save(cart);
      }

      return this.responseService.success("Cart retrieved successfully", cart);
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve cart",
        { error: error.message },
      );
    }
  }

  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<StandardResponse<Cart>> {
    try {
      const { productId, quantity } = addToCartDto;

      // Validate product
      const productResponse = await this.productsService.findById(productId);
      if (!productResponse.success) {
        return this.responseService.badRequest(productResponse.message);
      }

      const product = productResponse.data;
      const cartResponse = await this.getOrCreateCart(userId);
      if (!cartResponse.success) {
        return cartResponse;
      }

      const cart = cartResponse.data;

      // Check if item already exists in cart
      let cartItem = await this.cartItemRepository.findOne({
        where: { cart_id: cart.id, product_id: productId },
      });

      if (cartItem) {
        // Update existing item
        cartItem.quantity += quantity;
        cartItem.total_price = cartItem.quantity * product.price;
        await this.cartItemRepository.save(cartItem);
      } else {
        // Create new item
        cartItem = this.cartItemRepository.create({
          cart_id: cart.id,
          product_id: productId,
          quantity,
          unit_price: product.price,
          total_price: quantity * product.price,
        });
        await this.cartItemRepository.save(cartItem);
      }

      // Update cart total
      await this.updateCartTotal(cart.id);

      const updatedCartResponse = await this.getOrCreateCart(userId);
      if (updatedCartResponse.success) {
        return this.responseService.success(
          "Item added to cart successfully",
          updatedCartResponse.data,
        );
      }

      return updatedCartResponse;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to add item to cart",
        { error: error.message },
      );
    }
  }

  async removeFromCart(
    userId: string,
    itemId: string,
  ): Promise<StandardResponse<Cart>> {
    try {
      const cartResponse = await this.getOrCreateCart(userId);
      if (!cartResponse.success) {
        return cartResponse;
      }

      const cart = cartResponse.data;

      const cartItem = await this.cartItemRepository.findOne({
        where: { id: itemId, cart_id: cart.id },
      });

      if (!cartItem) {
        return this.responseService.notFound("Cart item not found");
      }

      await this.cartItemRepository.delete(itemId);
      await this.updateCartTotal(cart.id);

      const updatedCartResponse = await this.getOrCreateCart(userId);
      if (updatedCartResponse.success) {
        return this.responseService.success(
          "Item removed from cart successfully",
          updatedCartResponse.data,
        );
      }

      return updatedCartResponse;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to remove item from cart",
        { error: error.message },
      );
    }
  }

  async updateCartItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<StandardResponse<Cart>> {
    try {
      const cartResponse = await this.getOrCreateCart(userId);
      if (!cartResponse.success) {
        return cartResponse;
      }

      const cart = cartResponse.data;

      const cartItem = await this.cartItemRepository.findOne({
        where: { id: itemId, cart_id: cart.id },
        relations: ["product"],
      });

      if (!cartItem) {
        return this.responseService.notFound("Cart item not found");
      }

      if (quantity <= 0) {
        await this.cartItemRepository.delete(itemId);
      } else {
        cartItem.quantity = quantity;
        cartItem.total_price = quantity * cartItem.unit_price;
        await this.cartItemRepository.save(cartItem);
      }

      await this.updateCartTotal(cart.id);

      const updatedCartResponse = await this.getOrCreateCart(userId);
      if (updatedCartResponse.success) {
        return this.responseService.success(
          "Cart item quantity updated successfully",
          updatedCartResponse.data,
        );
      }

      return updatedCartResponse;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to update cart item quantity",
        { error: error.message },
      );
    }
  }

  async clearCart(userId: string): Promise<StandardResponse<any>> {
    try {
      const cartResponse = await this.getOrCreateCart(userId);
      if (!cartResponse.success) {
        return cartResponse;
      }

      const cart = cartResponse.data;

      await this.cartItemRepository.delete({ cart_id: cart.id });
      await this.cartRepository.update(cart.id, { total_amount: 0 });

      return this.responseService.success("Cart cleared successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError("Failed to clear cart", {
        error: error.message,
      });
    }
  }

  private async updateCartTotal(cartId: string): Promise<void> {
    const result = await this.cartItemRepository
      .createQueryBuilder("item")
      .select("SUM(item.total_price)", "total")
      .where("item.cart_id = :cartId", { cartId })
      .getRawOne();

    const total = parseInt(result.total) || 0;

    await this.cartRepository.update(cartId, { total_amount: total });
  }
}
