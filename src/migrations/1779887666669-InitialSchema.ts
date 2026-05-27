import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1779887666669 implements MigrationInterface {
  name = 'InitialSchema1779887666669';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "provider" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "display_name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_39c1a7b4cdd7cfb27b9ee9e5002" UNIQUE ("name"), CONSTRAINT "PK_6ab2f66d8987bf1bfdd6136a2d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "inference_log" ("id" SERIAL NOT NULL, "chat_id" integer NOT NULL, "message_id" integer NOT NULL, "provider" character varying(100) NOT NULL, "model" character varying(150) NOT NULL, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "total_tokens" integer NOT NULL DEFAULT '0', "latency_ms" integer, "status" character varying(20) NOT NULL, "error_message" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_62fb7f199f14d68a04808a8d0f8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_message" ("id" SERIAL NOT NULL, "chat_id" integer NOT NULL, "sender" "public"."chat_message_sender_enum" NOT NULL, "content" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "provider_model_id" integer, CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "provider_model" ("id" SERIAL NOT NULL, "user_provider_id" integer NOT NULL, "model" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c141516da01bb08540623e01d34" UNIQUE ("user_provider_id", "model"), CONSTRAINT "PK_b9c925bbc2c7c495c7a42da515c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_provider" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "provider_id" integer NOT NULL, "api_key" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_11887c9535d36471206b2d889d3" UNIQUE ("user_id", "provider_id"), CONSTRAINT "PK_5e3a2b86fd9a9c22c266ae04731" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "created_on" TIMESTAMP NOT NULL DEFAULT now(), "updated_on" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "summary_so_far" text, CONSTRAINT "PK_9d0b2ba74336710fd31154738a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD CONSTRAINT "FK_cf24bdb0ce873261a2d40eaf382" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" ADD CONSTRAINT "FK_017a7690871a659b2fabaaf4f2b" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_634db173c52edece8dd88ea3d4c" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_20531fe5792fad516cd99ae9efc" FOREIGN KEY ("provider_model_id") REFERENCES "provider_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_model" ADD CONSTRAINT "FK_43dde623bdb07fbd7a09c6aae71" FOREIGN KEY ("user_provider_id") REFERENCES "user_provider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_provider" ADD CONSTRAINT "FK_559c5787bd99d04865c31f158a8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_provider" ADD CONSTRAINT "FK_dd13e2801d2073391f346a58ae1" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD CONSTRAINT "FK_15d83eb496fd7bec7368b30dbf3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat" DROP CONSTRAINT "FK_15d83eb496fd7bec7368b30dbf3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_provider" DROP CONSTRAINT "FK_dd13e2801d2073391f346a58ae1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_provider" DROP CONSTRAINT "FK_559c5787bd99d04865c31f158a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_model" DROP CONSTRAINT "FK_43dde623bdb07fbd7a09c6aae71"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "FK_20531fe5792fad516cd99ae9efc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "FK_634db173c52edece8dd88ea3d4c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP CONSTRAINT "FK_017a7690871a659b2fabaaf4f2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inference_log" DROP CONSTRAINT "FK_cf24bdb0ce873261a2d40eaf382"`,
    );
    await queryRunner.query(`DROP TABLE "chat"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "user_provider"`);
    await queryRunner.query(`DROP TABLE "provider_model"`);
    await queryRunner.query(`DROP TABLE "chat_message"`);
    await queryRunner.query(`DROP TABLE "inference_log"`);
    await queryRunner.query(`DROP TABLE "provider"`);
  }
}
