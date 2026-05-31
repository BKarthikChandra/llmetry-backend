import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  chatId!: number;

  @ApiProperty({ enum: ['user', 'ai'] })
  sender!: 'user' | 'ai';

  @ApiProperty({ nullable: true })
  content!: string | null;

  @ApiProperty({
    description: 'Chat message creation timestamp as stored in the database.',
    example: '2026-05-31T20:31:47.089Z',
  })
  createdOn!: string;

  @ApiProperty({ nullable: true })
  providerModelId!: number | null;
}
