import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('store_affiliates')
export class StoreAffiliate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  // 'affiliate' | 'courier' | 'manager'
  @Column({ type: 'varchar', length: 30, default: 'affiliate' })
  role: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Store', (store: any) => store.affiliates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('User', (user: any) => user.store_affiliations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
