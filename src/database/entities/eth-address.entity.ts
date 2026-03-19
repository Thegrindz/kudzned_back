import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Wallet } from "./wallet.entity";

@Entity("eth_addresses")
export class ETHAddress {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  wallet_id: string;

  @Column({ unique: true })
  address: string;

  @Column({ nullable: true })
  private_key: string; // Encrypted

  @Column({ default: false })
  is_used: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: true })
  is_monitored: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Wallet, (wallet) => wallet.eth_addresses)
  @JoinColumn({ name: "wallet_id" })
  wallet: Wallet;
}
