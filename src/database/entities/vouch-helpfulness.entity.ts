import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Vouch } from "./vouch.entity";

export enum VouchHelpfulnessType {
  HELPFUL = "helpful",
  NOT_HELPFUL = "not_helpful",
}

@Entity("vouch_helpfulness")
@Index(["user_id", "vouch_id"], { unique: true }) // Prevent duplicate votes
@Index(["vouch_id", "vote_type"])
export class VouchHelpfulness {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  @Index()
  user_id: string;

  @Column({ type: "uuid" })
  @Index()
  vouch_id: string;

  @Column({
    type: "enum",
    enum: VouchHelpfulnessType,
  })
  vote_type: VouchHelpfulnessType;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Vouch, (vouch) => vouch.helpfulness_votes, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "vouch_id" })
  vouch: Vouch;
}
