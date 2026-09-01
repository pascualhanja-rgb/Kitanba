import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity.js';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'int' })
  category_id: number;

  @Column({ type: 'varchar', length: 1500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock_quantity: number;

  @Column({ type: 'varchar', length: 250 })
  shipping_type: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  shipping_cost: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs for circular deps, direct import for non-circular
  @ManyToOne('Store', (store: any) => store.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany('ProductImage', (img: any) => img.product, { cascade: true })
  images: any[];

  @OneToMany('ProductAttributeValue', (val: any) => val.product, { cascade: true })
  attribute_values: any[];

  @OneToMany('Advertisement', (ad: any) => ad.product)
  advertisements: any[];
}
