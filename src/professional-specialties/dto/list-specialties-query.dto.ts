import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListSpecialtiesQueryDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  include_inactive?: boolean;
}
