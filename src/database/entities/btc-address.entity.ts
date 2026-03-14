import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';

@Entity('btc_addresses')
export class BTCAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  wallet_id: string;

  @Column({ unique: true })
  address: string;

  @Column()
  private_key: string; // Encrypted

  @Column({ default: false })
  is_used: boolean;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Wallet, wallet => wallet.btc_addresses)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}