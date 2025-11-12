import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', unique: true })
  telegram_id: string;

  @Column({ type: 'bigint', nullable: true })
  leader_id: string | null;

  @Column({ nullable: true })
  username: string | null;

  @Column({ nullable: true })
  first_name: string | null;

  @Column({ nullable: true })
  last_name: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  email: string | null;

  @Column({ default: false })
  is_subscribed: boolean;

  @Column({ nullable: true })
  leader_id_access_token: string | null;

  @Column({ nullable: true })
  leader_id_refresh_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  leader_id_expires_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
