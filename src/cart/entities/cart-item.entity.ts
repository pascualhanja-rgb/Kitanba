import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  cart_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'uuid', nullable: true })
  variant_id: string | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  special_instructions: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne('Cart', (cart: any) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: any;

  @ManyToOne('Product', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @ManyToOne('ProductVariant', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant: any;
}
