import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('provider_specialties')
@Unique(['store_id', 'specialty_id'])
export class ProviderSpecialty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'int' })
  specialty_id: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Store', (store: any) => store.providerSpecialties, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne(
    'ProfessionalSpecialty',
    (specialty: any) => specialty.providerSpecialties,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'specialty_id' })
  specialty: any;
}
