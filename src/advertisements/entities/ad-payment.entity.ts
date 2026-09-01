import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('ad_payments')
export class AdPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ad_id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  transaction_ref: string;

  @Column({ type: 'varchar', length: 250, default: 'pending' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string ref to avoid circular dep
  @ManyToOne('Advertisement', (ad: any) => ad.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ad_id' })
  ad: any;
}
