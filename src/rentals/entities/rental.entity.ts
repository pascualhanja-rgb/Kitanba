import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('rentals')
export class Rental {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'timestamptz' })
  start_date: Date;

  @Column({ type: 'timestamptz' })
  end_date: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rental_price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  security_deposit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  // pending | active | returned | overdue | damaged | cancelled
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne('User', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @ManyToOne('Store', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('Product', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: any;
}
