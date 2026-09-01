import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface UploadResult {
  url: string;
  public_id: string;
  format: string;
  size: number;
}

export interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  // Tipos MIME permitidos
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  private readonly ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  private readonly ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

  // Tamanhos máximos
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

  constructor(
    private readonly configService: ConfigService,
    @Inject('CLOUDINARY_CONFIG')
    private readonly cloudinaryConfig: CloudinaryConfig,
  ) {}

  /**
   * Validar ficheiro antes de upload
   */
  validateFile(
    file: Express.Multer.File,
    purpose: 'image' | 'document' | 'video' = 'image',
  ): void {
    if (!file) {
      throw new BadRequestException('Nenhum ficheiro fornecido');
    }

    // Verificar tipo MIME
    let allowedTypes: string[];
    let maxSize: number;

    switch (purpose) {
      case 'image':
        allowedTypes = this.ALLOWED_IMAGE_TYPES;
        maxSize = this.MAX_IMAGE_SIZE;
        break;
      case 'document':
        allowedTypes = this.ALLOWED_DOCUMENT_TYPES;
        maxSize = this.MAX_DOCUMENT_SIZE;
        break;
      case 'video':
        allowedTypes = this.ALLOWED_VIDEO_TYPES;
        maxSize = this.MAX_VIDEO_SIZE;
        break;
    }

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de ficheiro não permitido: ${file.mimetype}. Tipos aceites: ${allowedTypes.join(', ')}`,
      );
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(
        `Ficheiro excede o tamanho máximo de ${maxSizeMB}MB`,
      );
    }

    // Verificar extensão vs MIME (previne bypass)
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeExtMap: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
      ],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    };

    const validExtensions = mimeExtMap[file.mimetype] || [];
    if (!validExtensions.includes(ext)) {
      throw new BadRequestException(
        `Extensão ${ext} não corresponde ao tipo ${file.mimetype}`,
      );
    }
  }

  /**
   * Upload local (para desenvolvimento)
   * Em produção, usar Cloudinary
   */
  async uploadLocal(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<UploadResult> {
    const uploadDir = path.join(process.cwd(), 'uploads', folder);

    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Gerar nome seguro (sem caracteres especiais)
    const safeFilename = this.generateSafeFilename(file.originalname);
    const filePath = path.join(uploadDir, safeFilename);

    // Guardar ficheiro
    fs.writeFileSync(filePath, file.buffer);

    const url = `/uploads/${folder}/${safeFilename}`;

    this.logger.log(`Ficheiro guardado localmente: ${url}`);

    return {
      url,
      public_id: `${folder}/${safeFilename}`,
      format: path.extname(file.originalname).slice(1),
      size: file.size,
    };
  }

  /**
   * Upload para Cloudinary (produção)
   */
  async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string = 'kitanda',
  ): Promise<UploadResult> {
    if (
      !this.cloudinaryConfig.cloud_name ||
      !this.cloudinaryConfig.api_key
    ) {
      this.logger.warn(
        'Cloudinary não configurado. Usando upload local.',
      );
      return this.uploadLocal(file, folder);
    }

    // Dinâmico import do cloudinary para não falhar se não estiver instalado
    try {
      const cloudinary = (await import('cloudinary')).v2;

      cloudinary.config({
        cloud_name: this.cloudinaryConfig.cloud_name,
        api_key: this.cloudinaryConfig.api_key,
        api_secret: this.cloudinaryConfig.api_secret,
      });

      // Upload como base64
      const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload(
          base64,
          {
            folder,
            resource_type: 'auto',
            // Transformação de segurança
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
      });

      this.logger.log(`Ficheiro enviado para Cloudinary: ${result.public_id}`);

      return {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        size: result.bytes,
      };
    } catch (error) {
      this.logger.error(
        `Erro no upload Cloudinary: ${error.message}`,
      );
      // Fallback para upload local
      return this.uploadLocal(file, folder);
    }
  }

  /**
   * Eliminar ficheiro do Cloudinary
   */
  async deleteFromCloudinary(publicId: string): Promise<void> {
    try {
      const cloudinary = (await import('cloudinary')).v2;

      cloudinary.config({
        cloud_name: this.cloudinaryConfig.cloud_name,
        api_key: this.cloudinaryConfig.api_key,
        api_secret: this.cloudinaryConfig.api_secret,
      });

      await cloudinary.uploader.destroy(publicId);

      this.logger.log(`Ficheiro eliminado do Cloudinary: ${publicId}`);
    } catch (error) {
      this.logger.error(
        `Erro ao eliminar do Cloudinary: ${error.message}`,
      );
    }
  }

  /**
   * Gerar nome de ficheiro seguro
   */
  private generateSafeFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${hash}${ext}`;
  }

  /**
   * Verificar se Cloudinary está configurado
   */
  isCloudinaryConfigured(): boolean {
    return !!(
      this.cloudinaryConfig.cloud_name &&
      this.cloudinaryConfig.api_key &&
      this.cloudinaryConfig.api_secret
    );
  }
}
