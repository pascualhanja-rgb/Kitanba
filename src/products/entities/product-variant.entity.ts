import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

/**
 * Variação de produto: tamanho/cor (boutique) ou adicional (comida).
 * O preço final = product.price (ou promocional) + additional_price.
 */
@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  additional_price: number;

  @Column({ type: 'int', default: 0 })
  stock_quantity: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne('Product', (product: any) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;
}
