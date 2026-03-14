import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from './product.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  cart_id: string;

  @Column('uuid')
  product_id: string;

  @Column()
  quantity: number;

  @Column('bigint')
  unit_price: number;

  @Column('bigint')
  total_price: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Cart, cart => cart.items)
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}