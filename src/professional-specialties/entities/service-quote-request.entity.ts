import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type ServiceQuoteStatus =
  | 'pending'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

@Entity('service_quote_requests')
export class ServiceQuoteRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @Column({ type: 'int', nullable: true })
  specialty_id: number | null;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  photo_url: string | null;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  @Column({
    type: 'varchar',
    length: 25,
    default: 'pending',
  })
  status: ServiceQuoteStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  proposed_price: number | null;

  @Column({ type: 'text', nullable: true })
  admin_or_provider_notes: string | null;

  @Column({ type: 'date', nullable: true })
  scheduled_date: Date | null;

  @Column({ type: 'time', nullable: true })
  scheduled_time: Date | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Store', (store: any) => store.quoteRequests, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne(
    'ProfessionalSpecialty',
    (specialty: any) => specialty.quoteRequests,
    { onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'specialty_id' })
  specialty: any;
}
