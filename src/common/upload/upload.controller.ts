import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { UploadService } from './upload.service.js';
import { memoryStorage } from 'multer';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload de imagem (perfil, produto, etc.)' })
  @ApiResponse({ status: 200, description: 'Upload bem-sucedido' })
  @ApiResponse({ status: 400, description: 'Ficheiro inválido' })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum ficheiro fornecido');
    }

    // Validar ficheiro
    this.uploadService.validateFile(file, 'image');

    // Upload
    const result = await this.uploadService.uploadToCloudinary(file, 'images');

    return {
      message: 'Imagem enviada com sucesso',
      ...result,
    };
  }

  @Post('document')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload de documento (comprovativo, identidade, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Upload bem-sucedido' })
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum ficheiro fornecido');
    }

    this.uploadService.validateFile(file, 'document');

    const result = await this.uploadService.uploadToCloudinary(file, 'documents');

    return {
      message: 'Documento enviado com sucesso',
      ...result,
    };
  }
}
