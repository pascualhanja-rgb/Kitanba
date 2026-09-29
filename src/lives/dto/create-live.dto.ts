import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLiveDto {
  @ApiProperty({ example: 'Sextou com promoções ao vivo!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ example: 'Venda ao vivo com descontos exclusivos' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateLiveDto {
  @ApiPropertyOptional({ example: 'https://cdn.stream.com/live/abc.m3u8' })
  @IsOptional()
  @IsString()
  playback_url?: string;

  @ApiPropertyOptional({ example: 'Título atualizado' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ example: 'Descrição atualizada' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Esse produto tem tamanho M?' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_question?: boolean;
}
