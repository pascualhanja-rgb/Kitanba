import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';

@Entity('campaign_products')
export class CampaignProduct {
  // Chave Primária Composta (campaign_id + product_id)
  @PrimaryColumn({ type: 'uuid' })
  campaign_id: string;

  @PrimaryColumn({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  promotional_price: number;

  // Relations - string refs para evitar dependências circulares em ESM
  @ManyToOne('PromotionalCampaign', (campaign: any) => campaign.campaign_products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: any;

  @ManyToOne('Product', (product: any) => product.campaign_products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;
}