import { IsArray, IsInt, IsNotEmpty, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AssignSpecialtiesDto {
  @ApiProperty({ example: [1, 3] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  specialty_ids: number[];
}
