import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('delivery_tracking_logs')
export class DeliveryTrackingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  delivery_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude: number;

  // Ângulo de rotação da seta (0 a 360°)
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  heading: number | null;

  // Velocidade atual
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  speed: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Delivery', (delivery: any) => delivery.tracking_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_id' })
  delivery: any;
}
