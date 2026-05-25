import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const PRESENCE_TTL = 65; // seconds

@Injectable()
export class PresenceService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async setOnline(userId: string, orgId: string, data: any = {}) {
    const key = 'presence:v2:' + userId;
    const val = JSON.stringify({
      status: 'ONLINE', userId, orgId,
      lastActivityAt: Date.now(),
      todayActiveSecs: data.todayActiveSecs ?? 0,
      platform: data.platform,
      currentUrl: data.currentUrl,
      currentTitle: data.currentTitle,
    });
    await this.redis.setex(key, PRESENCE_TTL, val);
    await this.redis.sadd('pres:org:online:' + orgId, userId);
  }

  async setOffline(userId: string, orgId: string) {
    await this.redis.del('presence:v2:' + userId);
    await this.redis.srem('pres:org:online:' + orgId, userId);
  }

  async getPresence(userId: string) {
    const val = await this.redis.get('presence:v2:' + userId);
    if (!val) return { userId, status: 'OFFLINE', lastActivityAt: null };
    return JSON.parse(val);
  }

  async getOrgPresence(orgId: string) {
    const onlineIds = await this.redis.smembers('pres:org:online:' + orgId);
    if (!onlineIds.length) return {};

    const pipeline = this.redis.pipeline();
    onlineIds.forEach(id => pipeline.get('presence:v2:' + id));
    const results = await pipeline.exec();

    const presence: Record<string, any> = {};
    onlineIds.forEach((id, i) => {
      const val = results?.[i]?.[1];
      presence[id] = val ? JSON.parse(val as string) : { userId: id, status: 'OFFLINE' };
    });
    return presence;
  }
}
