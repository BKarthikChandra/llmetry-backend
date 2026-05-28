import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatMessage } from '../../entities/chat.message.entity';

import { ChatService } from './chat.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('/:chatId/messages')
  @ApiOperation({ summary: 'Get all messages for a chat' })
  @ApiParam({ name: 'chatId', type: Number, description: 'ID of the chat' })
  @ApiResponse({ status: 200, description: 'Messages ordered by createdAt ASC' })
  @ApiResponse({ status: 403, description: 'Chat does not belong to the authenticated user' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  getMessages(
    @Param('chatId', ParseIntPipe) chatId: number,
    @CurrentUser('id') userId: number,
  ): Promise<ChatMessage[]> {
    return this.chatService.getMessages(userId, chatId);
  }

  @Post('/:modelId/send')
  @ApiOperation({
    summary: 'Send message to AI model',
    description:
      'Sends a user message to the selected AI model and returns the response. ' +
      'Pass chatId to continue an existing conversation; omit it to start a new one. ' +
      'The response always includes the chatId to use in subsequent turns.',
  })
  @ApiParam({
    name: 'modelId',
    type: Number,
    example: 1,
    description: 'ID of the ProviderModel to use',
  })
  @ApiQuery({
    name: 'chatId',
    required: false,
    type: Number,
    example: 42,
    description: 'Omit to start a new chat',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Hello!' },
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
        chatId: 42,
      },
    },
  })
  async sendMessage(
    @Param('modelId', ParseIntPipe) modelId: number,
    @CurrentUser('id') userId: number,
    @Body('message') message: string,
    @Query('chatId', new ParseIntPipe({ optional: true })) chatId?: number,
  ): Promise<{ response: string; chatId: number }> {
    return this.chatService.sendMessage(userId, modelId, message, chatId);
  }
}
