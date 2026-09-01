import { IsUUID, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({
    description: 'ID da loja com a qual o cliente quer falar',
    example: 'uuid-da-loja',
  })
  @IsUUID()
  @IsNotEmpty()
  store_id: string;

  @ApiPropertyOptional({
    description: 'ID do produto (opcional - para contexto da conversa)',
    example: 'uuid-do-produto',
  })
  @IsOptional()
  @IsUUID()
  product_id?: string;
}
