import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';

@Entity('service_details')
export class ServiceDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  product_id: string;

  // fixed | per_hour | per_sqm | quote_required
  @Column({ type: 'varchar', length: 20 })
  pricing_type: string;

  @Column({ type: 'int', default: 60 })
  estimated_duration_minutes: number;

  @Column({ type: 'boolean', default: false })
  requires_site_visit: boolean;

  @OneToOne('Product', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;
}
