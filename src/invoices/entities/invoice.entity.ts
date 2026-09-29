import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoice_number: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid', nullable: true })
  delivery_id: string | null;

  @Column({ type: 'uuid' })
  customer_id: string;

  // Dados do emissor no momento da emissão
  @Column({ type: 'varchar', length: 150 })
  issuer_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  issuer_nif: string | null;

  @Column({ type: 'varchar', length: 20 })
  entity_type: string;

  // Valores
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  // Token único da URL de download
  @Column({ type: 'varchar', length: 255, unique: true })
  download_token: string;

  @Column({ type: 'text', nullable: true })
  pdf_url: string | null;

  // 'draft' | 'issued' | 'paid' | 'cancelled'
  @Column({ type: 'varchar', length: 20, default: 'issued' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  issued_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Store', (store: any) => store.invoices, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('Delivery', (delivery: any) => delivery.invoices, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'delivery_id' })
  delivery: any;

  @ManyToOne('User', (user: any) => user.invoices, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @OneToMany('InvoiceItem', (item: any) => item.invoice, { cascade: true })
  items: any[];
}
