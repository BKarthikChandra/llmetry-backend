import { MigrationInterface, QueryRunner } from 'typeorm';

export class Provider1779887710756 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            INSERT INTO "provider" ("name", "display_name") VALUES
            ('claude', 'Claude'),
            ('openai', 'OpenAI'),
            ('copilot', 'GitHub Copilot'),
            ('gemini', 'Gemini'),
            ('deepseek', 'DeepSeek')
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "provider" WHERE "name" IN ('claude', 'openai', 'copilot', 'gemini', 'deepseek')`,
    );
  }
}
