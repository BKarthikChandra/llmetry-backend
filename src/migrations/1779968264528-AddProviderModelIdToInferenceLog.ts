import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderModelIdToInferenceLog1779968264528 implements MigrationInterface {
  name = 'AddProviderModelIdToInferenceLog1779968264528';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD "provider_model_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD CONSTRAINT "FK_3a87ac942057e87ccec70c162fc" FOREIGN KEY ("provider_model_id") REFERENCES "provider_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP CONSTRAINT "FK_3a87ac942057e87ccec70c162fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP COLUMN "provider_model_id"`,
    );
  }
}
