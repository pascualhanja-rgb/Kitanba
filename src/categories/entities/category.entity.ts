import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  parent_id: number;

  @Column({ type: 'varchar', length: 1000 })
  name: string;

  @Column({ type: 'varchar', length: 1000, unique: true })
  slug: string;

  // Relations - string refs for circular deps
  @ManyToOne('Category', (cat: any) => cat.children, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: any;

  @OneToMany('Category', (cat: any) => cat.parent)
  children: any[];

  @OneToMany('CategoryAttribute', (attr: any) => attr.category)
  attributes: any[];
}
