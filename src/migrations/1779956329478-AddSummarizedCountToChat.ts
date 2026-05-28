import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSummarizedCountToChat1779956329478 implements MigrationInterface {
  name = 'AddSummarizedCountToChat1779956329478';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_model_cache" DROP CONSTRAINT "FK_provider_model_cache_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD "summarized_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_model_cache" ADD CONSTRAINT "FK_203d07f52bfb30074db18fbff9f" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_model_cache" DROP CONSTRAINT "FK_203d07f52bfb30074db18fbff9f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" DROP COLUMN "summarized_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_model_cache" ADD CONSTRAINT "FK_provider_model_cache_provider" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
