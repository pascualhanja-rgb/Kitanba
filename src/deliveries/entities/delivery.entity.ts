import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid', nullable: true })
  courier_id: string | null;

  @Column({ type: 'uuid' })
  customer_id: string;

  // Pedido associado (preenchido quando a entrega nasce de um pedido)
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  // Localizações (OpenStreetMap)
  @Column({ type: 'text' })
  pickup_address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  pickup_latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  pickup_longitude: number;

  @Column({ type: 'text' })
  delivery_address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  delivery_latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  delivery_longitude: number;

  // Status da entrega
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  fee: number;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Store', (store: any) => store.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('User', (user: any) => user.deliveries_as_courier, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'courier_id' })
  courier: any;

  @ManyToOne('User', (user: any) => user.deliveries_as_customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @ManyToOne('Order', (order: any) => order.deliveries, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: any;

  @OneToMany('DeliveryTrackingLog', (log: any) => log.delivery, { cascade: true })
  tracking_logs: any[];

  @OneToMany('Invoice', (invoice: any) => invoice.delivery)
  invoices: any[];
}
