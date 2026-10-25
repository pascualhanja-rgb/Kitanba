import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Login por telefone: garante que cada telefone pertence a um único utilizador.
 * Índice parcial (phone IS NOT NULL) para permitir contas registadas sem telefone.
 */
export class AddUniquePhoneIndex1700000000003
  implements MigrationInterface
{
  name = 'AddUniquePhoneIndex1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UX_users_phone
      ON users(phone)
      WHERE phone IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS UX_users_phone;
    `);
  }
}
