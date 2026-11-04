import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';

@Entity('real_estate_details')
export class RealEstateDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  product_id: string;

  // house | apartment | land | commercial
  @Column({ type: 'varchar', length: 30 })
  property_type: string;

  // sale | rent
  @Column({ type: 'varchar', length: 20 })
  transaction_type: string;

  @Column({ type: 'int', default: 0 })
  bedrooms: number;

  @Column({ type: 'int', default: 0 })
  bathrooms: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  area_sqm: number | null;

  @Column({ type: 'text' })
  location_address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  @OneToOne('Product', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;
}
