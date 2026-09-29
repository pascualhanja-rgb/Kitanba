import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  order_number: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  // Endereço de entrega do cliente (casa)
  @Column({ type: 'text' })
  delivery_address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  delivery_latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  delivery_longitude: number;

  @Column({ type: 'text', nullable: true })
  delivery_notes: string | null;

  // Valores
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  shipping_cost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  // Estado do pedido
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('User', (user: any) => user.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @ManyToOne('Store', (store: any) => store.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @OneToMany('OrderItem', (item: any) => item.order, { cascade: true })
  items: any[];

  @OneToMany('Delivery', (delivery: any) => delivery.order)
  deliveries: any[];
}
