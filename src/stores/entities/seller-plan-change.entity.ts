import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('seller_plan_changes')
export class SellerPlanChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid' })
  admin_id: string;

  @Column({ type: 'int' })
  old_plan_id: number;

  @Column({ type: 'int' })
  new_plan_id: number;

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn({ type: 'timestamptz' })
  changed_at: Date;

  // Relations - string refs to avoid circular deps
  @ManyToOne('Store', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('User', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'admin_id' })
  admin: any;

  @ManyToOne('SellerPlan', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'old_plan_id' })
  old_plan: any;

  @ManyToOne('SellerPlan', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'new_plan_id' })
  new_plan: any;
}
