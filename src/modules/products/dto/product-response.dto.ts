import { ApiProperty } from "@nestjs/swagger";

export class CategoryResponseDto {
  @ApiProperty({ example: "uuid-string" })
  id: string;

  @ApiProperty({ example: "E-books" })
  name: string;

  @ApiProperty({ example: "e-books" })
  slug: string;

  @ApiProperty({ example: "Digital books and publications" })
  description: string;

  @ApiProperty({ example: "https://example.com/image.jpg", required: false })
  image_url?: string;

  @ApiProperty({ example: true })
  is_active: boolean;
}

export class VendorResponseDto {
  @ApiProperty({ example: "uuid-string" })
  id: string;

  @ApiProperty({ example: "vendor1" })
  username: string;
}

export class ProductResponseDto {
  @ApiProperty({ example: "uuid-string" })
  id: string;

  @ApiProperty({ example: "Amazing E-book" })
  title: string;

  @ApiProperty({ example: "A comprehensive guide to digital marketing" })
  description: string;

  @ApiProperty({ example: 50000, description: "Price in satoshis" })
  price: number;

  @ApiProperty({
    example: [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
    ],
  })
  images: string[];

  @ApiProperty({ example: ["ebook", "marketing", "digital"] })
  tags: string[];

  @ApiProperty({
    example: "active",
    enum: ["draft", "active", "inactive", "archived"],
  })
  status: string;

  @ApiProperty({
    example: "in_stock",
    enum: ["in_stock", "out_of_stock", "discontinued"],
  })
  availability: string;

  @ApiProperty({ example: 150 })
  total_sales: number;

  @ApiProperty({ example: 4.5 })
  rating: number;

  @ApiProperty({ example: 25 })
  review_count: number;

  @ApiProperty({ type: CategoryResponseDto })
  category: CategoryResponseDto;

  @ApiProperty({ type: VendorResponseDto })
  vendor: VendorResponseDto;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  created_at: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updated_at: string;
}

export class ProductListResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  products: ProductResponseDto[];

  @ApiProperty({
    example: {
      page: 1,
      limit: 20,
      total: 100,
      pages: 5,
      hasNext: true,
      hasPrev: false,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
