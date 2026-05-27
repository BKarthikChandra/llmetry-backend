import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export type JwtUser = { id: number; email: string };

export const CurrentUser = createParamDecorator(
  (field: keyof JwtUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: JwtUser }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
