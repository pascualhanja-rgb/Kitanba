import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable quando a mensagem é ligada diretamente a um Reels (advertisement_id)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  room_id: string;

  // Mensagem ligada diretamente a um Reels publicado (advertisements)
  // Quando preenchido, room_id pode ser NULL (mensagem sobre o vídeo)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  advertisement_id: string;

  @Column({ type: 'uuid' })
  sender_id: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  media_url: string;

  @Column({ type: 'text', nullable: true })
  document_url: string;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Index()
  @Column({
    type: 'timestamptz',
    default: () => "CURRENT_TIMESTAMP + INTERVAL '72 hours'",
  })
  expires_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('ChatRoom', (room: any) => room.messages, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'room_id' })
  room: any;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: any;

  @ManyToOne('Advertisement', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'advertisement_id' })
  advertisement: any;
}
