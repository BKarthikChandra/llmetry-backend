import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatMessageDto } from './dto/chat-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('/:chatId/messages')
  @ApiOperation({ summary: 'Get all messages for a chat' })
  @ApiParam({ name: 'chatId', type: Number, description: 'ID of the chat' })
  @ApiResponse({
    status: 200,
    description: 'Messages ordered by createdOn ASC',
    type: [ChatMessageDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Chat does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  getMessages(
    @Param('chatId', ParseIntPipe) chatId: number,
    @CurrentUser('id') userId: number,
  ): Promise<ChatMessageDto[]> {
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
    @Body() dto: SendMessageDto,
    @Query('chatId', new ParseIntPipe({ optional: true })) chatId?: number,
  ): Promise<{ response: string; chatId: number }> {
    return this.chatService.sendMessage(userId, modelId, dto.message, chatId);
  }

  @Post('/:modelId/send/stream')
  @ApiOperation({
    summary: 'Stream AI model response via SSE',
    description:
      'Sends a user message and streams the response as Server-Sent Events. ' +
      'Events: `delta` (text chunk), `done` (final stats + chatId), `error` (on failure).',
  })
  @ApiParam({ name: 'modelId', type: Number, example: 1 })
  @ApiQuery({ name: 'chatId', required: false, type: Number, example: 42 })
  @ApiResponse({
    status: 200,
    description:
      'SSE stream — event: delta | done | error',
    schema: {
      example:
        'event: delta\ndata: {"chunk":"Hello"}\n\nevent: done\ndata: {"chatId":42,"inputTokens":10,"outputTokens":20,"totalTokens":30,"latencyMs":1200}\n\n',
    },
  })
  async sendMessageStream(
    @Param('modelId', ParseIntPipe) modelId: number,
    @CurrentUser('id') userId: number,
    @Body() dto: SendMessageDto,
    @Query('chatId', new ParseIntPipe({ optional: true })) chatId: number | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const result = await this.chatService.sendMessageStream(
        userId,
        modelId,
        dto.message,
        chatId,
        (chunk: string) =>
          res.write(`event: delta\ndata: ${JSON.stringify({ chunk })}\n\n`),
      );
      res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
    } catch (err) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Delete('/:chatId')
  @ApiOperation({ summary: 'Delete a chat' })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'ID of the chat to delete',
  })
  @ApiResponse({ status: 200, description: 'Chat deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Chat does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async deleteChat(
    @Param('chatId', ParseIntPipe) chatId: number,
    @CurrentUser('id') userId: number,
  ): Promise<{ message: string }> {
    return this.chatService.deleteChat(userId, chatId);
  }
}
