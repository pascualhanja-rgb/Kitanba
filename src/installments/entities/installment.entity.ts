import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('installments')
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  rental_id: string | null;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'int' })
  installment_number: number;

  @Column({ type: 'int' })
  total_installments: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  due_date: string;

  // pending | paid | overdue | cancelled
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method: string | null;

  @Column({ type: 'text', nullable: true })
  payment_proof_url: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne('Order', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: any;

  @ManyToOne('Rental', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rental_id' })
  rental: any;

  @ManyToOne('User', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @ManyToOne('Store', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: any;
}
