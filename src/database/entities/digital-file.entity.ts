import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Product } from "./product.entity";

@Entity("digital_files")
export class DigitalFile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  product_id: string;

  @Column()
  filename: string;

  @Column()
  original_name: string;

  @Column()
  file_path: string;

  @Column()
  file_size: number;

  @Column()
  mime_type: string;

  @Column({ default: 0 })
  download_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Product, (product) => product.digital_files)
  @JoinColumn({ name: "product_id" })
  product: Product;
}
