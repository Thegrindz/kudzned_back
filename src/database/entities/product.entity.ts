import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ProductStatus, ProductAvailability } from '../../common/enums/product.enum';
import { User } from './user.entity';
import { Category } from './category.entity';
import { DigitalFile } from './digital-file.entity';
import { OrderItem } from './order-item.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  vendor_id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('uuid')
  category_id: string;

  @Column('bigint')
  price: number; // in satoshis

  @Column('json', { nullable: true })
  images: string[];

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.DRAFT })
  status: ProductStatus;

  @Column({ type: 'enum', enum: ProductAvailability, default: ProductAvailability.IN_STOCK })
  availability: ProductAvailability;

  @Column({ default: 0 })
  total_sales: number;

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  review_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, user => user.products)
  @JoinColumn({ name: 'vendor_id' })
  vendor: User;

  @ManyToOne(() => Category, category => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => DigitalFile, file => file.product)
  digital_files: DigitalFile[];

  @OneToMany(() => OrderItem, item => item.product)
  order_items: OrderItem[];
}