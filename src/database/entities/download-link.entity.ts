import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { DigitalFile } from './digital-file.entity';

@Entity('download_links')
export class DownloadLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  order_id: string;

  @Column('uuid')
  digital_file_id: string;

  @Column({ unique: true })
  token: string;

  @Column()
  expires_at: Date;

  @Column({ default: 0 })
  download_count: number;

  @Column({ default: 5 })
  max_downloads: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Order, order => order.download_links)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => DigitalFile)
  @JoinColumn({ name: 'digital_file_id' })
  digital_file: DigitalFile;
}