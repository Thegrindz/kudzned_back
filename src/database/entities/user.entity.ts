import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserRole, UserStatus, KYCStatus } from '../../common/enums/user.enum';
import { Wallet } from './wallet.entity';
import { Order } from './order.entity';
import { Notification } from './notification.entity';
import { Product } from './product.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ unique: true })
  username: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ nullable: true })
  phone_number: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'enum', enum: KYCStatus, default: KYCStatus.NOT_STARTED })
  kyc_status: KYCStatus;

  @Column({ default: false })
  two_factor_enabled: boolean;

  @Column({ nullable: true })
  two_factor_secret: string;

  @Column({ default: false })
  email_verified: boolean;

  @Column({ nullable: true })
  email_verification_token: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  last_login_at: Date;

  // Relations
  @OneToOne(() => Wallet, wallet => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Order, order => order.user)
  orders: Order[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];

  @OneToMany(() => Product, product => product.vendor)
  products: Product[];
}