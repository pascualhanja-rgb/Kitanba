import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('customer_password_resets')
export class CustomerPasswordReset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  token: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'boolean', default: false })
  is_used: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string ref to avoid circular dep in ESM
  @ManyToOne('User', (user: any) => user.password_resets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
