import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryAttributeDto {
  @ApiProperty({ example: 'Tamanho' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'text', enum: ['text', 'number', 'select'] })
  @IsString()
  @IsIn(['text', 'number', 'select'])
  data_type: string;
}
