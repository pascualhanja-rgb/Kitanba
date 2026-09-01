import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CategoryAttribute } from '../../categories/entities/category-attribute.entity.js';

@Entity('product_attribute_values')
export class ProductAttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'int' })
  attribute_id: number;

  @Column({ type: 'text' })
  value: string;

  // Relations - string ref for circular dep, direct for non-circular
  @ManyToOne('Product', (product: any) => product.attribute_values, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @ManyToOne(() => CategoryAttribute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attribute_id' })
  attribute: CategoryAttribute;
}
