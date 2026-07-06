import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/decorators/index';
import { JwtAuthGuard } from '../auth/guards/index';
import { ChatGateway } from './chat.gateway';

@Controller('api/v1/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('channels')
  getChannels(@CurrentUser() user: any) {
    return this.chat.getChannels(user.orgId, user.sub ?? user.id);
  }

  @Get('unread-total')
  getUnreadTotal(@CurrentUser() user: any) {
    return this.chat.getUnreadTotal(user.orgId, user.sub ?? user.id);
  }

  @Post('channels/direct')
  getOrCreateDirect(@CurrentUser() user: any, @Body() body: { userId: string }) {
    return this.chat.getOrCreateDirectChannel(user.orgId, user.sub ?? user.id, body.userId);
  }

  @Post('channels/group')
  createGroup(@CurrentUser() user: any, @Body() body: { name: string; memberIds: string[]; departmentId?: string; projectId?: string }) {
    return this.chat.createGroupChannel(user.orgId, user.sub ?? user.id, body);
  }

  @Get('channels/:id/messages')
  getMessages(@CurrentUser() user: any, @Param('id') id: string, @Query('limit') limit?: string, @Query('before') before?: string) {
    return this.chat.getMessages(id, user.sub ?? user.id, parseInt(limit ?? '50'), before);
  }

  @Post('channels/:id/messages')
  async sendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    const message = await this.chat.sendMessage(id, user.sub ?? user.id, body);
    this.gateway.broadcastMessage(id, message);
    return message;
  }

  @Patch('messages/:messageId')
  async editMessage(@CurrentUser() user: any, @Param('messageId') messageId: string, @Body() body: { content: string }) {
    const msg = await this.chat.editMessage(messageId, user.sub ?? user.id, body.content);
    this.gateway.broadcastEdit(msg.channelId, msg);
    return msg;
  }

  @Delete('messages/:messageId')
  async deleteMessage(@CurrentUser() user: any, @Param('messageId') messageId: string) {
    const res = await this.chat.deleteMessage(messageId, user.sub ?? user.id);
    this.gateway.broadcastDelete(res.channelId, messageId);
    return res;
  }

  @Post('messages/:messageId/react')
  async react(@CurrentUser() user: any, @Param('messageId') messageId: string, @Body() body: { emoji: string }) {
    const msg = await this.chat.toggleReaction(messageId, user.sub ?? user.id, body.emoji);
    this.gateway.broadcastReaction(msg.channelId, msg);
    return msg;
  }

  @Post('channels/:id/pin')
  pinMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { messageId: string | null }) {
    return this.chat.pinMessage(id, user.sub ?? user.id, body.messageId);
  }

  @Post('messages/:messageId/forward')
  async forward(@CurrentUser() user: any, @Param('messageId') messageId: string, @Body() body: { targetChannelId: string }) {
    const message = await this.chat.forwardMessage(messageId, body.targetChannelId, user.sub ?? user.id);
    this.gateway.broadcastMessage(body.targetChannelId, message);
    return message;
  }

  @Patch('channels/:id/avatar')
  updateAvatar(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { avatarUrl: string }) {
    return this.chat.updateChannelAvatar(id, user.sub ?? user.id, body.avatarUrl);
  }

  @Get('channels/:id/search')
  searchMessages(@CurrentUser() user: any, @Param('id') id: string, @Query('q') q: string) {
    return this.chat.searchMessages(id, user.sub ?? user.id, q ?? '');
  }

  @Patch('channels/:id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chat.markAsRead(id, user.sub ?? user.id);
  }

  @Post('channels/:id/members')
  addMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { userId: string }) {
    return this.chat.addMember(id, user.sub ?? user.id, body.userId);
  }

  @Delete('channels/:id/members/:userId')
  removeMember(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.chat.removeMember(id, user.sub ?? user.id, userId);
  }

  @Get('users/search')
  searchUsers(@CurrentUser() user: any, @Query('q') q: string) {
    return this.chat.searchUsers(user.orgId, user.sub ?? user.id, q ?? '');
  }
}
