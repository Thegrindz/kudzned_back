import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { CategoryService } from "./category.service";

import { Product } from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import { DigitalFile } from "../../database/entities/digital-file.entity";
import { ResponseService } from "../../common/services/response.service";
import { CloudinaryService } from "../../common/services/cloudinary.service";

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, DigitalFile])],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    CategoryService,
    ResponseService,
    CloudinaryService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
