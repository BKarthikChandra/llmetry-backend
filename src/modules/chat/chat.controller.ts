import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ChatService } from './chat.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('/:modelId/send')
  @ApiOperation({
    summary: 'Send message to AI model',
    description: 'Sends a user message to the selected AI model and returns the response.',
  })
  @ApiParam({
    name: 'modelId',
    type: Number,
    example: 1,
    description: 'AI model ID',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Hello AI',
        },
      },
      required: ['message'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Message processed successfully',
    schema: {
      example: {
        response: 'Hello! How can I help you?',
      },
    },
  })
  async sendMessage(
    @Param('modelId', ParseIntPipe) modelId: number,
    @CurrentUser('id') userId: number,
    @Body('message') message: string,
  ): Promise<{ response: string }> {
    return this.chatService.sendMessage(userId, modelId, message);
  }
}