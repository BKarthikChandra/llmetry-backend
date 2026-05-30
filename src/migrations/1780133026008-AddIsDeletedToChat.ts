import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToChat1780133026008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat" ADD COLUMN "is_deleted" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat" RENAME COLUMN "created_at" TO "created_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" RENAME COLUMN "created_at" TO "created_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider" RENAME COLUMN "created_at" TO "created_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_provider" RENAME COLUMN "created_at" TO "created_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" RENAME COLUMN "created_at" TO "created_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_model" RENAME COLUMN "created_at" TO "created_on"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_model" RENAME COLUMN "created_on" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" RENAME COLUMN "created_on" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_provider" RENAME COLUMN "created_on" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider" RENAME COLUMN "created_on" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" RENAME COLUMN "created_on" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" RENAME COLUMN "created_on" TO "created_at"`,
    );

    await queryRunner.query(`ALTER TABLE "chat" DROP COLUMN "is_deleted"`);
  }
}
