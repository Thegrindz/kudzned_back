import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum NotificationType {
  ORDER_CREATED = "order_created",
  ORDER_COMPLETED = "order_completed",
  PAYMENT_RECEIVED = "payment_received",
  DEPOSIT_CONFIRMED = "deposit_confirmed",
  KYC_APPROVED = "kyc_approved",
  KYC_REJECTED = "kyc_rejected",
  PROFILE_UPDATED = "profile_updated",
  PASSWORD_CHANGED = "password_changed",
  VOUCH_CREATED = "vouch_created",
  VOUCH_APPROVED = "vouch_approved",
  VOUCH_REJECTED = "vouch_rejected",
  CASHOUT_CLIP_CREATED = "cashout_clip_created",
  CASHOUT_CLIP_APPROVED = "cashout_clip_approved",
  CASHOUT_CLIP_REJECTED = "cashout_clip_rejected",
  LOGIN_SUCCESS = "login_success",
  SIGNUP_SUCCESS = "signup_success",
  TWO_FACTOR_ENABLED = "two_factor_enabled",
  TWO_FACTOR_DISABLED = "two_factor_disabled",
  SYSTEM = "system",
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  user_id: string;

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column("text")
  message: string;

  @Column("json", { nullable: true })
  data: any;

  @Column({ default: false })
  is_read: boolean;

  @Column({ default: false })
  is_email_sent: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.notifications)
  @JoinColumn({ name: "user_id" })
  user: User;
}
