import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('promotional_campaigns')
export class PromotionalCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  // Ex: "Sextou da Kitanda", "Black Friday"
  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 30, default: 'sextou' })
  campaign_type: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discount_percentage: number;

  @Column({ type: 'timestamptz' })
  starts_at: Date;

  @Column({ type: 'timestamptz' })
  ends_at: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Store', (store: any) => store.promotional_campaigns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @OneToMany('CampaignProduct', (cp: any) => cp.campaign, { cascade: true })
  campaign_products: any[];
}
