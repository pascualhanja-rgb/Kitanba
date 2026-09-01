import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('plan_upgrade_requests')
export class PlanUpgradeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'int' })
  requested_plan_id: number;

  @Column({ type: 'varchar', length: 250, default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  payment_proof_url: string;

  @Column({ type: 'text', nullable: true })
  admin_notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps
  @ManyToOne('Store', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('SellerPlan', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_plan_id' })
  requested_plan: any;
}
