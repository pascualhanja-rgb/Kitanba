import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('professional_specialties')
export class ProfessionalSpecialty {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  icon_url: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @OneToMany('ProviderSpecialty', (ps: any) => ps.specialty)
  providerSpecialties: any[];

  @OneToMany('ServiceQuoteRequest', (quote: any) => quote.specialty)
  quoteRequests: any[];
}
