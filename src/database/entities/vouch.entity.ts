import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Product } from "./product.entity";
import { Order } from "./order.entity";
import { VouchHelpfulness } from "./vouch-helpfulness.entity";

export enum VouchStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  FLAGGED = "flagged",
}

export enum VouchTag {
  FAST_DELIVERY = "fast_delivery",
  HIGH_BALANCE = "high_balance",
  SECURE = "secure",
  RELIABLE = "reliable",
  GOOD_SUPPORT = "good_support",
  EASY_CASHOUT = "easy_cashout",
  VERIFIED_SELLER = "verified_seller",
}

@Entity("vouches")
@Index(["user_id", "product_id"], { unique: true }) // Prevent duplicate vouches
@Index(["product_id", "status", "created_at"])
@Index(["rating", "created_at"])
export class Vouch {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  @Index()
  user_id: string;

  @Column({ type: "uuid" })
  @Index()
  product_id: string;

  @Column({ type: "uuid", nullable: true })
  order_id: string;

  @Column({ nullable: true })
  rating: number; // 1-5 stars

  @Column({ type: "text" })
  comment: string;

  @Column({ type: "text", nullable: true })
  proof_image_url: string;

  @Column({
    type: "enum",
    enum: VouchStatus,
    default: VouchStatus.PENDING,
  })
  @Index()
  status: VouchStatus;

  @Column({
    type: "simple-array",
    nullable: true,
  })
  tags: string[];

  @Column({ type: "int", default: 0 })
  helpful_count: number;

  @Column({ type: "int", default: 0 })
  not_helpful_count: number;

  @Column({ type: "boolean", default: true })
  is_verified_purchase: boolean;

  @Column({ type: "boolean", default: false })
  is_deleted: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "product_id" })
  product: Product;

  @ManyToOne(() => Order, { onDelete: "SET NULL" })
  @JoinColumn({ name: "order_id" })
  order: Order;

  @OneToMany(() => VouchHelpfulness, (helpfulness) => helpfulness.vouch)
  helpfulness_votes: VouchHelpfulness[];
}
