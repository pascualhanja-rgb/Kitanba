import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'rescheduled',
];

@Entity('service_bookings')
export class ServiceBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'uuid', nullable: true })
  provider_id: string | null;

  @Column({ type: 'date' })
  scheduled_date: string;

  @Column({ type: 'time' })
  scheduled_time: string;

  @Column({ type: 'text' })
  service_address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  service_latitude: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  service_longitude: number | null;

  // pending | confirmed | in_progress | completed | cancelled | rescheduled
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  @Column({ type: 'text', nullable: true })
  notes_from_customer: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

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

  @ManyToOne('User', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'provider_id' })
  provider: any;
}
