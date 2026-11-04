import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('call_logs')
export class CallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  caller_id: string;

  @Column({ type: 'uuid' })
  receiver_id: string;

  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  delivery_id: string | null;

  // initiated | ringing | answered | missed | rejected | ended
  @Column({ type: 'varchar', length: 30, default: 'initiated' })
  status: string;

  @Column({ type: 'int', default: 0 })
  duration_seconds: number;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caller_id' })
  caller: any;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_id' })
  receiver: any;
}
