import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
