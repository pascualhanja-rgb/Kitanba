import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  avatar_url: string;

  @Column({ type: 'text', nullable: true })
  document_url: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    enum: ['customer', 'seller', 'admin'],
  })
  user_type: string;

  @Column({ type: 'boolean', default: false })
  is_email_verified: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - all use string refs to avoid circular deps in ESM
  @OneToMany('UserOtp', (otp: any) => otp.user)
  otps: any[];

  @OneToMany('CustomerPasswordReset', (reset: any) => reset.user)
  password_resets: any[];

  @OneToMany('FailedLoginAttempt', (attempt: any) => attempt.user)
  failed_login_attempts: any[];

  @OneToMany('Store', (store: any) => store.owner)
  stores: any[];

  @OneToMany('Message', (message: any) => message.sender)
  sent_messages: any[];
}
