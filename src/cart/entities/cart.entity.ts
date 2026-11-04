import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Um carrinho por cliente (UNIQUE) */
  @Column({ type: 'uuid', unique: true })
  customer_id: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany('CartItem', (item: any) => item.cart, { cascade: true })
  items: any[];
}
