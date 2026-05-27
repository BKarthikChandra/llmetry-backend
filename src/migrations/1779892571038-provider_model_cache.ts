import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderModelCache1779892571038 implements MigrationInterface {
  name = 'ProviderModelCache1779892571038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "provider_model_cache" (
        "id" SERIAL NOT NULL,
        "provider_id" integer NOT NULL,
        "models" jsonb NOT NULL,
        "cached_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_provider_model_cache_provider_id" UNIQUE ("provider_id"),
        CONSTRAINT "PK_provider_model_cache" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_model_cache"
       ADD CONSTRAINT "FK_provider_model_cache_provider"
       FOREIGN KEY ("provider_id") REFERENCES "provider"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_model_cache" DROP CONSTRAINT "FK_provider_model_cache_provider"`,
    );
    await queryRunner.query(`DROP TABLE "provider_model_cache"`);
  }
}
