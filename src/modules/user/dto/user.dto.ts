import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ProviderDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  displayName!: string;
}

export class RegisterProviderDto {
  @ApiProperty({ description: 'API key for the provider' })
  @IsString()
  @IsNotEmpty()
  apiKey!: string;
}

export class RegisteredProviderDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  registeredAt!: Date;
}

export class AddModelDto {
  @ApiProperty({
    description: 'Model identifier (e.g. gpt-4o, claude-opus-4-7)',
  })
  @IsString()
  @IsNotEmpty()
  model!: string;
}

export class ProviderModelDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  model!: string;

  @ApiProperty()
  createdOn!: Date;
}

export class ChatSummaryDto {
  @ApiProperty()
  chatId!: number;

  @ApiProperty()
  createdOn!: Date;

  @ApiProperty()
  lastActivityAt!: Date | null;

  @ApiProperty({ nullable: true })
  title!: string | null;
}
