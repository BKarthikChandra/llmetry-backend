import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  AddModelDto,
  ProviderDto,
  ProviderModelDto,
  RegisteredProviderDto,
  RegisterProviderDto,
} from './dto/user.dto';
import { UserService } from './user.service';

@ApiTags('user')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'Get all available providers' })
  @ApiResponse({
    status: 200,
    description: 'List of available providers',
    type: [ProviderDto],
  })
  getProviders(): Promise<ProviderDto[]> {
    return this.userService.getProviders();
  }

  @Get('providers/registered')
  @ApiOperation({ summary: 'Get providers registered by the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of registered providers',
    type: [RegisteredProviderDto],
  })
  getRegisteredProviders(
    @CurrentUser() user: JwtUser,
  ): Promise<RegisteredProviderDto[]> {
    return this.userService.getRegisteredProviders(user.id);
  }

  @Post('providers/:id/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a provider with an API key' })
  @ApiResponse({ status: 201, description: 'Provider registered successfully' })
  @ApiResponse({ status: 409, description: 'Provider already registered' })
  registerProvider(
    @Param('id', ParseIntPipe) providerId: number,
    @Body() dto: RegisterProviderDto,
    @CurrentUser() user: JwtUser,
  ): Promise<{ message: string }> {
    return this.userService.registerProvider(user.id, providerId, dto);
  }

  @Get('providers/:id/models')
  @ApiOperation({ summary: 'Get configured models for a registered provider' })
  @ApiResponse({
    status: 200,
    description: 'List of configured models',
    type: [ProviderModelDto],
  })
  @ApiResponse({ status: 404, description: 'Provider not registered' })
  getModels(
    @Param('id', ParseIntPipe) providerId: number,
    @CurrentUser() user: JwtUser,
  ): Promise<ProviderModelDto[]> {
    return this.userService.getModels(user.id, providerId);
  }

  @Post('providers/:id/models')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a model under a registered provider' })
  @ApiResponse({ status: 201, description: 'Model added successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid model — response includes availableModels list',
  })
  @ApiResponse({ status: 404, description: 'Provider not registered' })
  @ApiResponse({ status: 409, description: 'Model already configured' })
  addModel(
    @Param('id', ParseIntPipe) providerId: number,
    @Body() dto: AddModelDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.userService.addModel(user.id, providerId, dto);
  }
}
