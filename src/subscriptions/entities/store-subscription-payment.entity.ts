import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('store_subscriptions_payments')
export class StoreSubscriptionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'int' })
  plan_id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Column({ type: 'varchar', length: 250 })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps
  @ManyToOne('Store', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('SellerPlan', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: any;
}
