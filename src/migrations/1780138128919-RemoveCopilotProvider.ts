import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCopilotProvider1780138128919 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "provider" WHERE "name" = 'copilot'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "provider" ("name", "display_name") VALUES ('copilot', 'GitHub Copilot')
       ON CONFLICT ("name") DO NOTHING`,
    );
  }
}
