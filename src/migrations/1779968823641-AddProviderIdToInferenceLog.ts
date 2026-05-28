import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderIdToInferenceLog1779968823641 implements MigrationInterface {
  name = 'AddProviderIdToInferenceLog1779968823641';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD "provider_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD CONSTRAINT "FK_fa70a9278f662adb54f71b09f77" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP CONSTRAINT "FK_fa70a9278f662adb54f71b09f77"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP COLUMN "provider_id"`,
    );
  }
}
