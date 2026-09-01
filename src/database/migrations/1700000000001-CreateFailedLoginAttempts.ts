import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFailedLoginAttempts1700000000001
  implements MigrationInterface
{
  name = 'CreateFailedLoginAttempts1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS failed_login_attempts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        email_attempted VARCHAR(150) NOT NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_failed_login_user_id ON failed_login_attempts(user_id);
      CREATE INDEX IF NOT EXISTS idx_failed_login_email ON failed_login_attempts(email_attempted);
      CREATE INDEX IF NOT EXISTS idx_failed_login_created_at ON failed_login_attempts(created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS failed_login_attempts;`);
  }
}
