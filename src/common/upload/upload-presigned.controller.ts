import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { UploadPresignedService } from './upload-presigned.service.js';
import { RequestPresignedUrlDto } from './dto/request-presigned-url.dto.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadPresignedController {
  constructor(
    private readonly presignedService: UploadPresignedService,
  ) {}

  /**
   * (1) Solicitar URL de upload presigned
   *
   * O frontend chama este endpoint antes de fazer upload.
   * Recebe uma URL temporária para fazer PUT directamente no R2.
   *
   * Fluxo:
   *  Frontend --> POST /uploads/presigned-url --> Backend
   *  Backend  --> Devolve { upload_url, file_key, public_url }
   *  Frontend --> PUT upload_url (com o ficheiro) --> R2 (directo)
   *  Frontend --> POST /uploads/confirm --> Backend (confirma)
   */
  @Post('presigned-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar Presigned URL para upload directo ao R2',
    description:
      'Gera uma URL temporária (1h) para o frontend fazer upload directo ao Cloudflare R2, ' +
      'sem o ficheiro passar pelo servidor. Ideal para vídeos, PDFs, imagens grandes e uploads em massa.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL gerada com sucesso',
    schema: {
      example: {
        upload_url: 'https://account.r2.cloudflarestorage.com/bucket/...',
        file_key: 'images/1700000000000-a1b2c3d4.jpg',
        public_url: 'https://cdn.seudominio.com/images/1700000000000-a1b2c3d4.jpg',
        expires_in: 3600,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Ficheiro inválido ou tipo não permitido' })
  async requestPresignedUrl(@Body() dto: RequestPresignedUrlDto) {
    if (!this.presignedService.isConfigured()) {
      throw new BadRequestException(
        'Upload presigned não configurado. Contacte o administrador.',
      );
    }

    return this.presignedService.generatePresignedUrl(
      dto.filename,
      dto.content_type,
      dto.folder || 'images',
      dto.max_size,
    );
  }

  /**
   * (4) Confirmar upload concluído
   *
   * O frontend chama DEPOIS de fazer PUT para o R2,
   * para que o backend valide que o ficheiro existe e devolva a URL final.
   *
   * Fluxo:
   *  Frontend --> POST /uploads/confirm --> Backend
   *  Backend  --> Valida objecto no R2 --> Devolve { url, file_key, confirmed }
   *  Backend  --> (opcional) Salva URL no banco de dados
   */
  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar que upload foi concluído no R2',
    description:
      'Valida que o ficheiro existe no R2 e devolva a URL pública. ' +
      'Chamar DEPOIS de fazer o PUT directo com a presigned URL.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload confirmado com sucesso',
    schema: {
      example: {
        url: 'https://cdn.seudominio.com/images/1700000000000-a1b2c3d4.jpg',
        file_key: 'images/1700000000000-a1b2c3d4.jpg',
        confirmed: true,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Upload não encontrado ou inválido' })
  async confirmUpload(@Body() dto: ConfirmUploadDto) {
    return this.presignedService.confirmUpload(
      dto.file_key,
      dto.original_name,
      dto.content_type,
      dto.file_size,
    );
  }
}
