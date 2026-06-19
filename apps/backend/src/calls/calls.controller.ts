import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/v1/calls')
export class CallsController {
  @Post('create')
  createRoom(@CurrentUser() user: any, @Body() body: { title?: string }) {
    const roomId = uuidv4();
    return {
      roomId,
      title: body?.title ?? 'Видеозвонок',
      createdBy: user.sub,
      url: `/dashboard/calls/${roomId}`,
    };
  }
}
