import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Transaction } from "./transaction.entity";
import { BTCAddress } from "./btc-address.entity";
import { ETHAddress } from "./eth-address.entity";

@Entity("wallets")
export class Wallet {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  user_id: string;

  @Column("bigint", { default: 0 })
  balance: number; // in satoshis

  @Column("bigint", { default: 0 })
  available_balance: number;

  @Column("bigint", { default: 0 })
  total_deposited: number;

  @Column("bigint", { default: 0 })
  total_withdrawn: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToOne(() => User, (user) => user.wallet)
  @JoinColumn({ name: "user_id" })
  user: User;

  @OneToMany(() => BTCAddress, (address) => address.wallet)
  btc_addresses: BTCAddress[];

  @OneToMany(() => ETHAddress, (address) => address.wallet)
  eth_addresses: ETHAddress[];

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];
}
