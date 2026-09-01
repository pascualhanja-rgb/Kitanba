import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('chat_rooms')
@Unique('unique_customer_store_product', ['customer_id', 'store_id', 'product_id'])
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  customer_id: string;

  @Index()
  @Column({ type: 'uuid' })
  store_id: string;

  @Column({ type: 'uuid', nullable: true })
  product_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations - string refs to avoid circular deps in ESM
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: any;

  @ManyToOne('Store', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: any;

  @ManyToOne('Product', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @OneToMany('Message', (message: any) => message.room)
  messages: any[];
}
