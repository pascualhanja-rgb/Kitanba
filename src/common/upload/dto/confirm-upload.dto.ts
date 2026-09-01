import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmUploadDto {
  @ApiProperty({
    description: 'Chave do objecto no bucket R2',
    example: 'images/1700000000000-a1b2c3d4.jpg',
  })
  @IsString()
  @IsNotEmpty()
  file_key: string;

  @ApiProperty({
    description: 'Nome original do ficheiro',
    example: 'produto-foto.jpg',
  })
  @IsString()
  @IsNotEmpty()
  original_name: string;

  @ApiProperty({
    description: 'Tipo MIME do ficheiro',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  content_type: string;

  @ApiProperty({
    description: 'Tamanho do ficheiro em bytes',
    example: 1048576,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  file_size?: number;
}
