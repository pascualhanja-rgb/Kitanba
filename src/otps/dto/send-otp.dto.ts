import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: 'account_activation' })
  @IsString()
  @IsNotEmpty()
  purpose: string;
}
