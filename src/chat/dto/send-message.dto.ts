import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'Conteúdo da mensagem (texto)',
    example: 'Olá, este produto ainda está disponível?',
  })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    description: 'URL de imagem enviada no chat',
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message: 'media_url deve ser uma URL válida',
  })
  media_url?: string;

  @ApiPropertyOptional({
    description: 'URL de documento (PDF/DOCX)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message: 'document_url deve ser uma URL válida',
  })
  document_url?: string;
}
