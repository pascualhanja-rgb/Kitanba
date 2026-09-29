import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  owner_id: string;

  @Column({ type: 'int' })
  plan_id: number;

  @Column({ type: 'varchar', length: 1000, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 1000, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  logo_url: string;

  @Column({ type: 'text', nullable: true })
  banner_url: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    length: 230,
    default: 'pending_approval',
  })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  subscription_end_date: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string;

  // Endereço/coordenadas de pickup (para entregas)
  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - all use string refs to avoid circular deps in ESM
  @ManyToOne('User', (user: any) => user.stores, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  owner: any;

  @ManyToOne('SellerPlan', (plan: any) => plan.stores, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: any;

  @OneToMany('Product', (product: any) => product.store)
  products: any[];

  @OneToMany('Advertisement', (ad: any) => ad.store)
  advertisements: any[];

  @OneToMany('ChatRoom', (room: any) => room.store)
  chat_rooms: any[];

  @OneToMany('StoreSubscriptionPayment', (payment: any) => payment.store)
  subscription_payments: any[];

  @OneToMany('Order', (order: any) => order.store)
  orders: any[];

  @OneToMany('Delivery', (delivery: any) => delivery.store)
  deliveries: any[];

  @OneToMany('StoreAffiliate', (affiliate: any) => affiliate.store)
  affiliates: any[];

  @OneToMany('PromotionalCampaign', (campaign: any) => campaign.store)
  promotional_campaigns: any[];

  @OneToMany('LiveStream', (live: any) => live.store)
  live_streams: any[];

  @OneToMany('Invoice', (invoice: any) => invoice.store)
  invoices: any[];

  @OneToOne('StoreBillingProfile', (profile: any) => profile.store)
  billing_profile: any;
}
