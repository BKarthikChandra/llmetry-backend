import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeInferenceLogMessageIdNullable1780137938858 implements MigrationInterface {
  name = 'MakeInferenceLogMessageIdNullable1780137938858';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP CONSTRAINT "FK_017a7690871a659b2fabaaf4f2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ALTER COLUMN "message_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD CONSTRAINT "FK_017a7690871a659b2fabaaf4f2b" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP CONSTRAINT "FK_017a7690871a659b2fabaaf4f2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ALTER COLUMN "message_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD CONSTRAINT "FK_017a7690871a659b2fabaaf4f2b" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
