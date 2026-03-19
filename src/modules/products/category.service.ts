import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Category } from "../../database/entities/category.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private responseService: ResponseService,
  ) {}

  async findAll(): Promise<StandardResponse<Category[]>> {
    try {
      const categories = await this.categoryRepository.find({
        where: { is_active: true },
        order: { sort_order: "ASC", name: "ASC" },
      });

      return this.responseService.success(
        "Categories retrieved successfully",
        categories,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve categories",
        { error: error.message },
      );
    }
  }

  async findById(id: string): Promise<StandardResponse<Category>> {
    try {
      const category = await this.categoryRepository.findOne({ where: { id } });

      if (!category) {
        return this.responseService.notFound("Category not found");
      }

      return this.responseService.success(
        "Category retrieved successfully",
        category,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve category",
        { error: error.message },
      );
    }
  }

  async findBySlug(slug: string): Promise<StandardResponse<Category>> {
    try {
      const category = await this.categoryRepository.findOne({
        where: { slug },
      });

      if (!category) {
        return this.responseService.notFound("Category not found");
      }

      return this.responseService.success(
        "Category retrieved successfully",
        category,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve category",
        { error: error.message },
      );
    }
  }

  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<StandardResponse<Category>> {
    try {
      const slug = this.generateSlug(createCategoryDto.name);

      const category = this.categoryRepository.create({
        ...createCategoryDto,
        slug,
      });

      const savedCategory = await this.categoryRepository.save(category);
      return this.responseService.created(
        "Category created successfully",
        savedCategory,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to create category",
        { error: error.message },
      );
    }
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<StandardResponse<Category>> {
    try {
      const categoryResponse = await this.findById(id);
      if (!categoryResponse.success) {
        return categoryResponse;
      }

      const category = categoryResponse.data;

      if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
        (updateCategoryDto as any).slug = this.generateSlug(
          updateCategoryDto.name,
        );
      }

      await this.categoryRepository.update(id, updateCategoryDto);
      const updatedCategoryResponse = await this.findById(id);

      if (updatedCategoryResponse.success) {
        return this.responseService.success(
          "Category updated successfully",
          updatedCategoryResponse.data,
        );
      }

      return updatedCategoryResponse;
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to update category",
        { error: error.message },
      );
    }
  }

  async delete(id: string): Promise<StandardResponse<any>> {
    try {
      const categoryResponse = await this.findById(id);
      if (!categoryResponse.success) {
        return categoryResponse;
      }

      await this.categoryRepository.delete(id);
      return this.responseService.success("Category deleted successfully", {
        success: true,
      });
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to delete category",
        { error: error.message },
      );
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
}
