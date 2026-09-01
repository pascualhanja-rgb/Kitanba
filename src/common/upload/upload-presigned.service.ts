import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PresignedUrlResult {
  upload_url: string;
  file_key: string;
  public_url: string;
  expires_in: number;
}

export interface R2Config {
  account_id: string;
  access_key_id: string;
  secret_access_key: string;
  bucket_name: string;
  public_domain: string;
}

/**
 * Configuração de tipos MIME permitidos por pasta
 */
const FOLDER_MIME_LIMITS: Record<string, { allowed: string[]; maxSize: number }> = {
  images: {
    allowed: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  documents: {
    allowed: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    maxSize: 25 * 1024 * 1024, // 25MB
  },
  videos: {
    allowed: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  avatars: {
    allowed: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  banners: {
    allowed: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};

@Injectable()
export class UploadPresignedService {
  private readonly logger = new Logger(UploadPresignedService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicDomain: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject('R2_CONFIG')
    private readonly r2Config: R2Config,
  ) {
    this.bucketName = this.r2Config.bucket_name;
    this.publicDomain = this.r2Config.public_domain;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.r2Config.account_id}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.r2Config.access_key_id,
        secretAccessKey: this.r2Config.secret_access_key,
      },
    });

    this.logger.log('R2 UploadPresignedService inicializado');
    this.logger.log(`R2 Configured: ${this.isConfigured()} | account_id=${!!this.r2Config.account_id} | access_key=${!!this.r2Config.access_key_id} | secret=${!!this.r2Config.secret_access_key} | bucket=${!!this.r2Config.bucket_name} | domain=${!!this.r2Config.public_domain}`);
  }

  /**
   * Valida o tipo MIME e tamanho contra os limites da pasta
   */
  private validateFile(
    contentType: string,
    folder: string,
    maxSize?: number,
  ): void {
    const limits = FOLDER_MIME_LIMITS[folder];
    if (!limits) {
      throw new BadRequestException(`Pasta inválida: ${folder}`);
    }

    if (!limits.allowed.includes(contentType)) {
      throw new BadRequestException(
        `Tipo de ficheiro não permitido: ${contentType}. ` +
        `Tipos aceites para '${folder}': ${limits.allowed.join(', ')}`,
      );
    }

    const effectiveMaxSize = maxSize || limits.maxSize;
    if (effectiveMaxSize > limits.maxSize) {
      throw new BadRequestException(
        `Tamanho máximo para '${folder}' é ${Math.round(limits.maxSize / (1024 * 1024))}MB`,
      );
    }
  }

  /**
   * Gerar chave única para o objecto no bucket
   */
  private generateFileKey(originalFilename: string, folder: string): string {
    const ext = path.extname(originalFilename).toLowerCase();
    const hash = crypto.randomBytes(12).toString('hex');
    const timestamp = Date.now();
    return `${folder}/${timestamp}-${hash}${ext}`;
  }

  /**
   * (1) Gerar Presigned URL para upload directo
   *
   * O frontend usa esta URL para fazer PUT directamente ao R2,
   * sem o ficheiro passar pelo servidor.
   */
  async generatePresignedUrl(
    filename: string,
    contentType: string,
    folder: string = 'images',
    maxSize?: number,
  ): Promise<PresignedUrlResult> {
    this.validateFile(contentType, folder, maxSize);

    const fileKey = this.generateFileKey(filename, folder);
    const expiresIn = 3600; // 1 hora

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: contentType,
      // Metadata opcional
      Metadata: {
        'original-name': encodeURIComponent(filename),
      },
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    const publicUrl = `${this.publicDomain}/${fileKey}`;

    this.logger.log(
      `Presigned URL gerada: key=${fileKey}, expires_in=${expiresIn}s`,
    );

    return {
      upload_url: uploadUrl,
      file_key: fileKey,
      public_url: publicUrl,
      expires_in: expiresIn,
    };
  }

  /**
   * (4) Confirmar que o upload foi concluído
   *
   * O frontend chama este método DEPOIS de fazer o PUT para o R2,
   * para que o backend valide e confirme o objecto.
   */
  async confirmUpload(
    fileKey: string,
    originalName: string,
    contentType: string,
    fileSize?: number,
  ): Promise<{ url: string; file_key: string; confirmed: boolean }> {
    try {
      // Verificar que o objecto existe no R2
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const headResult = await this.s3Client.send(headCommand);

      // Validações adicionais
      if (headResult.ContentType !== contentType) {
        this.logger.warn(
          `Content-Type mismatch: esperado=${contentType}, actual=${headResult.ContentType}`,
        );
      }

      if (fileSize && headResult.ContentLength !== fileSize) {
        this.logger.warn(
          `File size mismatch: esperado=${fileSize}, actual=${headResult.ContentLength}`,
        );
      }

      const publicUrl = `${this.publicDomain}/${fileKey}`;

      this.logger.log(`Upload confirmado: key=${fileKey}`);

      return {
        url: publicUrl,
        file_key: fileKey,
        confirmed: true,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao confirmar upload: key=${fileKey}, error=${error.message}`,
      );
      throw new BadRequestException(
        'Upload não encontrado. Verifique se o ficheiro foi enviado correctamente.',
      );
    }
  }

  /**
   * Obter URL pública de um ficheiro já existente
   */
  getPublicUrl(fileKey: string): string {
    return `${this.publicDomain}/${fileKey}`;
  }

  /**
   * Verificar se o serviço está configurado
   */
  isConfigured(): boolean {
    return !!(
      this.r2Config.account_id &&
      this.r2Config.access_key_id &&
      this.r2Config.secret_access_key &&
      this.r2Config.bucket_name &&
      this.r2Config.public_domain
    );
  }
}
