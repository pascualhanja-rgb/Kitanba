import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('live_streams')
export class LiveStream {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Chave de transmissão
  @Column({ type: 'varchar', length: 255, unique: true })
  stream_key: string;

  // URL HLS/WebRTC para os clientes assistirem
  @Column({ type: 'text', nullable: true })
  playback_url: string;

  // 'scheduled' | 'live' | 'ended'
  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('Store', (store: any) => store.live_streams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @OneToMany('LiveComment', (comment: any) => comment.live_stream)
  comments: any[];
}
