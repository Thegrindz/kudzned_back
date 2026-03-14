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
import { OrderStatus, PaymentStatus, FulfillmentStatus } from '../../common/enums/order.enum';
import { User } from './user.entity';
import { OrderItem } from './order-item.entity';
import { DownloadLink } from './download-link.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('bigint')
  total_amount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  payment_status: PaymentStatus;

  @Column({ type: 'enum', enum: FulfillmentStatus, default: FulfillmentStatus.PENDING })
  fulfillment_status: FulfillmentStatus;

  @Column({ nullable: true })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, user => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => OrderItem, item => item.order)
  items: OrderItem[];

  @OneToMany(() => DownloadLink, link => link.order)
  download_links: DownloadLink[];
}