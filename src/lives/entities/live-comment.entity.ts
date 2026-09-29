import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('live_comments')
export class LiveComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  live_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  message: string;

  // Se é uma pergunta destacada para o vendedor
  @Column({ type: 'boolean', default: false })
  is_question: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('LiveStream', (live: any) => live.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'live_id' })
  live_stream: any;

  @ManyToOne('User', (user: any) => user.live_comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
