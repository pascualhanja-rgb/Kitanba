import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';

@Entity('ad_pricing_plans')
export class AdPricingPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 1000 })
  name: string;

  @Column({ type: 'varchar', length: 220 })
  ad_type: string;

  @Column({ type: 'varchar', length: 250 })
  placement: string;

  @Column({ type: 'int' })
  duration_days: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // Relations - string ref to avoid circular dep
  @OneToMany('Advertisement', (ad: any) => ad.ad_plan)
  advertisements: any[];
}
