import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('store_status_logs')
export class StoreStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid' })
  admin_id: string;

  @Column({ type: 'varchar', length: 230 })
  previous_status: string;

  @Column({ type: 'varchar', length: 230 })
  new_status: string;

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps
  @ManyToOne('Store', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('User', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'admin_id' })
  admin: any;
}
