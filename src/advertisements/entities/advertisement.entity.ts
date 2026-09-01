import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('advertisements')
export class Advertisement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'int' })
  ad_plan_id: number;

  @Column({ type: 'uuid', nullable: true })
  product_id: string;

  @Column({ type: 'varchar', length: 1500 })
  title: string;

  @Column({ type: 'text' })
  media_url: string;

  @Column({ type: 'text', nullable: true })
  target_url: string;

  @Column({ type: 'timestamptz' })
  start_date: Date;

  @Column({ type: 'timestamptz' })
  end_date: Date;

  @Column({ type: 'int', default: 0 })
  impressions_count: number;

  @Column({ type: 'int', default: 0 })
  clicks_count: number;

  @Column({
    type: 'varchar',
    length: 230,
    default: 'pending_approval',
  })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps
  @ManyToOne('Store', (store: any) => store.advertisements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('AdPricingPlan', (plan: any) => plan.advertisements, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'ad_plan_id' })
  ad_plan: any;

  @ManyToOne('Product', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @OneToMany('AdPayment', (payment: any) => payment.ad)
  payments: any[];
}
