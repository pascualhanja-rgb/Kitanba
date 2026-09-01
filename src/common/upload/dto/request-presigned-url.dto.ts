import { IsString, IsIn, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPresignedUrlDto {
  @ApiProperty({
    description: 'Nome original do ficheiro',
    example: 'produto-foto.jpg',
  })
  @IsString()
  filename: string;

  @ApiProperty({
    description: 'Tipo MIME do ficheiro',
    example: 'image/jpeg',
  })
  @IsString()
  content_type: string;

  @ApiProperty({
    description: 'Pasta de destino no bucket',
    enum: ['images', 'documents', 'videos', 'avatars', 'banners'],
    default: 'images',
  })
  @IsOptional()
  @IsString()
  @IsIn(['images', 'documents', 'videos', 'avatars', 'banners'])
  folder?: string;

  @ApiProperty({
    description: 'Tamanho máximo do ficheiro em bytes (default 50MB)',
    example: 52428800,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1024)
  @Max(104857600) // 100MB max
  max_size?: number;
}
