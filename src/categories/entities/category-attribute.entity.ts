import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('category_attributes')
export class CategoryAttribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  category_id: number;

  @Column({ type: 'varchar', length: 250 })
  name: string;

  @Column({ type: 'varchar', length: 250 })
  data_type: string;

  // Relations - string ref to avoid circular dep
  @ManyToOne('Category', (cat: any) => cat.attributes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: any;
}
