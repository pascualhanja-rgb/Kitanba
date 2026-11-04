import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('store_service_schedules')
export class StoreServiceSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  /** 0 = domingo ... 6 = sábado */
  @Column({ type: 'int' })
  day_of_week: number;

  /** Formato HH:mm (TIME no PostgreSQL) */
  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @Column({ type: 'boolean', default: true })
  is_available: boolean;

  @ManyToOne('Store', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;
}
