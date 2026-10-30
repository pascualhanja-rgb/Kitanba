import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type SocialProviderDto = 'google' | 'apple';

export class SocialAuthDto {
  @ApiProperty({
    enum: ['google', 'apple'],
    description: 'Fornecedor do token social obtido nativamente no dispositivo',
  })
  @IsIn(['google', 'apple'])
  provider: SocialProviderDto;

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIs...',
    description:
      'ID Token obtido nativamente no Flutter (google_sign_in ou sign_in_with_apple)',
  })
  @IsString()
  token: string;

  @ApiPropertyOptional({ enum: ['customer', 'seller'], default: 'customer' })
  @IsOptional()
  @IsIn(['customer', 'seller'])
  user_type?: string;
}

export class SocialLinkDto {
  @ApiProperty({
    enum: ['google', 'apple'],
    description: 'Fornecedor do token social a ligar à conta autenticada atual',
  })
  @IsIn(['google', 'apple'])
  provider: SocialProviderDto;

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIs...',
    description:
      'ID Token obtido nativamente no Flutter a ligar à conta autenticada atual',
  })
  @IsString()
  token: string;
}
