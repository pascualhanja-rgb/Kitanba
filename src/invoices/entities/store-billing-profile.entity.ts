import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity('store_billing_profiles')
export class StoreBillingProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  store_id: string;

  // 'individual' | 'company'
  @Column({ type: 'varchar', length: 20 })
  entity_type: string;

  // Dados da empresa (caso 'company')
  @Column({ type: 'varchar', length: 150, nullable: true })
  company_name: string;

  // Número de Identificação Fiscal
  @Column({ type: 'varchar', length: 50 })
  nif: string;

  @Column({ type: 'text', nullable: true })
  tax_address: string;

  // Dados bancários
  @Column({ type: 'varchar', length: 100, nullable: true })
  bank_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  iban: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  swift: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @OneToOne('Store', (store: any) => store.billing_profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;
}
