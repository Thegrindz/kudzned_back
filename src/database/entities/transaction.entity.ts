import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import {
  TransactionType,
  TransactionStatus,
} from "../../common/enums/transaction.enum";
import { Wallet } from "./wallet.entity";

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  wallet_id: string;

  @Column({ type: "enum", enum: TransactionType })
  type: TransactionType;

  @Column("bigint")
  amount: number; // in satoshis (positive for credits, negative for debits)

  @Column({
    type: "enum",
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  btc_tx_hash: string;

  @Column({ nullable: true })
  eth_tx_hash: string;

  @Column({ nullable: true })
  crypto_address: string;

  @Column({ nullable: true })
  crypto_currency: string;

  @Column({ nullable: true })
  order_id: string;

  @Column({ nullable: true })
  description: string;

  @Column("json", { nullable: true })
  metadata: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({ name: "wallet_id" })
  wallet: Wallet;
}
