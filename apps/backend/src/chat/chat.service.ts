import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Channels list ──────────────────────────────────────────────────────────

  async getChannels(orgId: string, userId: string) {
    const memberships = await this.prisma.chatChannelMember.findMany({
      where: { userId, channel: { orgId } },
      include: {
        channel: {
          include: {
            members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    const channels = await Promise.all(memberships.map(async (m) => {
      const ch = m.channel;
      const unreadCount = await this.prisma.chatMessage.count({
        where: {
          channelId: ch.id,
          deletedAt: null,
          senderId: { not: userId },
          createdAt: { gt: m.lastReadAt ?? new Date(0) },
        },
      });

      // For DIRECT channels, resolve the "other" member for display name/avatar
      let displayName = ch.name;
      let displayAvatar = ch.avatarUrl;
      if (ch.type === 'DIRECT') {
        const other = ch.members.find(mm => mm.userId !== userId);
        displayName = other?.user?.name ?? 'Пользователь';
        displayAvatar = other?.user?.avatarUrl ?? null;
      }

      return {
        id: ch.id,
        type: ch.type,
        name: displayName,
        avatarUrl: displayAvatar,
        departmentId: ch.departmentId,
        projectId: ch.projectId,
        memberCount: ch.members.length,
        members: ch.members.map(mm => mm.user),
        lastMessage: ch.messages[0] ?? null,
        unreadCount,
        updatedAt: ch.messages[0]?.createdAt ?? ch.updatedAt,
      };
    }));

    // Most recently active first
    channels.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return channels;
  }

  // ─── Get or create DIRECT channel ───────────────────────────────────────────

  async getOrCreateDirectChannel(orgId: string, userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new BadRequestException('Нельзя создать чат с самим собой');

    const other = await this.prisma.user.findFirst({ where: { id: otherUserId, orgId, deletedAt: null } });
    if (!other) throw new NotFoundException('Пользователь не найден');

    // Find existing direct channel between these two users
    const existing = await this.prisma.chatChannel.findFirst({
      where: {
        orgId, type: 'DIRECT',
        members: { every: { userId: { in: [userId, otherUserId] } } },
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      include: { members: true },
    });

    if (existing && existing.members.length === 2) return existing;

    const channel = await this.prisma.chatChannel.create({
      data: {
        orgId, type: 'DIRECT', createdById: userId,
        members: { create: [{ userId }, { userId: otherUserId }] },
      },
      include: { members: true },
    });
    return channel;
  }

  // ─── Create GROUP channel ────────────────────────────────────────────────────

  async createGroupChannel(orgId: string, userId: string, dto: { name: string; memberIds: string[]; departmentId?: string; projectId?: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Название канала обязательно');

    const uniqueMembers = Array.from(new Set([...dto.memberIds, userId]));

    const channel = await this.prisma.chatChannel.create({
      data: {
        orgId, type: 'GROUP', name: dto.name.trim(),
        departmentId: dto.departmentId, projectId: dto.projectId,
        createdById: userId,
        members: {
          create: uniqueMembers.map(uid => ({ userId: uid, role: uid === userId ? 'owner' : 'member' })),
        },
      },
      include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
    });
    return channel;
  }

  // ─── Auto-create department channel (called when department created/member added) ──

  async ensureDepartmentChannel(orgId: string, departmentId: string, departmentName: string, creatorId: string, memberIds: string[]) {
    let channel = await this.prisma.chatChannel.findFirst({ where: { orgId, type: 'GROUP', departmentId } });
    if (!channel) {
      channel = await this.prisma.chatChannel.create({
        data: {
          orgId, type: 'GROUP', name: departmentName, departmentId,
          createdById: creatorId,
          members: { create: memberIds.map(uid => ({ userId: uid, role: uid === creatorId ? 'owner' : 'member' })) },
        },
      });
    } else {
      // Sync membership
      const existingMembers = await this.prisma.chatChannelMember.findMany({ where: { channelId: channel.id } });
      const existingIds = new Set(existingMembers.map(m => m.userId));
      const toAdd = memberIds.filter(id => !existingIds.has(id));
      if (toAdd.length) {
        await this.prisma.chatChannelMember.createMany({
          data: toAdd.map(uid => ({ channelId: channel!.id, userId: uid })),
          skipDuplicates: true,
        });
      }
    }
    return channel;
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  async getMessages(channelId: string, userId: string, limit = 50, before?: string) {
    await this.assertMember(channelId, userId);

    const where: any = { channelId, deletedAt: null };
    if (before) where.createdAt = { lt: new Date(before) };

    const messages = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    // Enrich with sender info
    const senderIds = Array.from(new Set(messages.map(m => m.senderId)));
    const senders = await this.prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true, avatarUrl: true } });
    const senderMap = new Map(senders.map(s => [s.id, s]));

    return messages.reverse().map(m => ({ ...m, sender: senderMap.get(m.senderId) }));
  }

  async sendMessage(channelId: string, userId: string, dto: { content?: string; attachmentUrl?: string; attachmentName?: string; attachmentType?: string }) {
    await this.assertMember(channelId, userId);
    if (!dto.content?.trim() && !dto.attachmentUrl) throw new BadRequestException('Сообщение не может быть пустым');

    const message = await this.prisma.chatMessage.create({
      data: {
        channelId, senderId: userId,
        content: dto.content?.trim(),
        attachmentUrl: dto.attachmentUrl,
        attachmentName: dto.attachmentName,
        attachmentType: dto.attachmentType,
      },
    });

    await this.prisma.chatChannel.update({ where: { id: channelId }, data: { updatedAt: new Date() } });

    const sender = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatarUrl: true } });
    return { ...message, sender };
  }

  async markAsRead(channelId: string, userId: string) {
    await this.assertMember(channelId, userId);
    await this.prisma.chatChannelMember.updateMany({
      where: { channelId, userId },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  async getUnreadTotal(orgId: string, userId: string) {
    const memberships = await this.prisma.chatChannelMember.findMany({
      where: { userId, channel: { orgId } },
      select: { channelId: true, lastReadAt: true },
    });
    let total = 0;
    for (const m of memberships) {
      total += await this.prisma.chatMessage.count({
        where: { channelId: m.channelId, deletedAt: null, senderId: { not: userId }, createdAt: { gt: m.lastReadAt ?? new Date(0) } },
      });
    }
    return { unreadTotal: total };
  }

  // ─── Members management (groups) ────────────────────────────────────────────

  async addMember(channelId: string, userId: string, newUserId: string) {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== 'GROUP') throw new BadRequestException('Можно добавлять участников только в групповой канал');
    await this.assertMember(channelId, userId);

    await this.prisma.chatChannelMember.create({ data: { channelId, userId: newUserId } }).catch(() => {});
    return { ok: true };
  }

  async removeMember(channelId: string, userId: string, targetUserId: string) {
    await this.assertMember(channelId, userId);
    await this.prisma.chatChannelMember.deleteMany({ where: { channelId, userId: targetUserId } });
    return { ok: true };
  }

  // ─── Search users for new chat/group ────────────────────────────────────────

  async searchUsers(orgId: string, currentUserId: string, query: string) {
    return this.prisma.user.findMany({
      where: {
        orgId, deletedAt: null, id: { not: currentUserId },
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: 20,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async assertMember(channelId: string, userId: string) {
    const member = await this.prisma.chatChannelMember.findFirst({ where: { channelId, userId } });
    if (!member) throw new ForbiddenException('Вы не являетесь участником этого канала');
  }
}
