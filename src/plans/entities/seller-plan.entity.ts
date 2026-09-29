import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('seller_plans')
export class SellerPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 250 })
  name: string;

  @Column({ type: 'varchar', length: 220, unique: true })
  tier: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monthly_price: number;

  @Column({ type: 'int' })
  max_products: number;

  @Column({ type: 'boolean', default: true })
  allow_flyer_ads: boolean;

  @Column({ type: 'boolean', default: false })
  allow_banner_ads: boolean;

  @Column({ type: 'boolean', default: false })
  allow_video_ads: boolean;

  // Limite de afiliados/membros da equipe (999999 = ilimitado)
  @Column({ type: 'int', default: 0 })
  max_affiliates: number;

  // Se o plano permite transmissões ao vivo
  @Column({ type: 'boolean', default: false })
  allow_live_stream: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations - string ref to avoid circular dep
  @OneToMany('Store', (store: any) => store.plan)
  stores: any[];
}
