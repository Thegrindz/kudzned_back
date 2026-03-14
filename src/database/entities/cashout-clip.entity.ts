import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Product } from './product.entity';

export enum CashoutClipStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
}



@Entity('cashout_clips')
@Index(['user_id', 'product_id'])
@Index(['status', 'created_at'])
@Index(['cashout_type', 'amount'])
export class CashoutClip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  user_id: string;

  @Column({ type: 'uuid' })
  @Index()
  product_id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  video_url: string;

  @Column({ type: 'text', nullable: true })
  thumbnail_url: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
   nullable:true
  })
  cashout_type: string;

  @Column({ type: 'text', nullable: true })
  payment_method: string; // e.g., "Chase Bank", "Bitcoin", "PayPal"

  @Column({
    type: 'enum',
    enum: CashoutClipStatus,
    default: CashoutClipStatus.PENDING,
  })
  @Index()
  status: CashoutClipStatus;

  @Column({ type: 'int', default: 0 })
  views_count: number;

  @Column({ type: 'int', default: 0 })
  likes_count: number;

  @Column({ type: 'int', default: 0 })
  duration_seconds: number;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ type: 'boolean', default: false })
  is_featured: boolean;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}