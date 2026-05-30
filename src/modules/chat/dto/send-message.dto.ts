import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'What is machine learning?', maxLength: 32000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32000)
  message!: string;
}
