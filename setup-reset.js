const fs = require('fs');
const os = require('os');
const home = os.homedir();

// 1. Add reset endpoint to backend
const resetController = `import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/index';
import { CurrentUser } from '../auth/decorators/index';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Controller('api/v1/reset')
@UseGuards(JwtAuthGuard)
export class ResetController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Post()
  async resetAll(@CurrentUser() user: any) {
    if (!user?.roles?.includes('ADMIN') && !user?.roles?.includes('SUPER_ADMIN')) {
      return { error: 'Forbidden' };
    }

    const orgId = user.orgId;

    // Clear activity events
    await this.prisma.activityEvent.deleteMany({ where: { orgId } });

    // Clear analytics
    await this.prisma.analyticsHourly.deleteMany({ where: { orgId } }).catch(() => {});

    // Clear realtime status
    await this.prisma.realtimeStatus.deleteMany({ where: { orgId } }).catch(() => {});

    // Clear tasks (keep structure)
    await this.prisma.taskHistory.deleteMany({ where: { task: { orgId } } }).catch(() => {});
    await this.prisma.taskComment.deleteMany({ where: { task: { orgId } } }).catch(() => {});
    await this.prisma.task.deleteMany({ where: { orgId } }).catch(() => {});

    // Clear work sessions from redis
    const keys = await this.redis.keys(\`work:session:*\`);
    if (keys.length > 0) await this.redis.del(...keys);

    // Clear presence from redis
    const presenceKeys = await this.redis.keys(\`presence:*\`);
    if (presenceKeys.length > 0) await this.redis.del(...presenceKeys);

    return {
      success: true,
      message: 'Все данные очищены',
      cleared: ['activityEvents', 'analytics', 'realtimeStatus', 'tasks', 'workSessions', 'presence']
    };
  }
}
`;

fs.writeFileSync(home + '/employee-tracker/apps/backend/src/reset/reset.controller.ts', (() => {
  require('fs').mkdirSync(home + '/employee-tracker/apps/backend/src/reset', { recursive: true });
  return resetController;
})());

// 2. Add reset module
const resetModule = `import { Module } from '@nestjs/common';
import { ResetController } from './reset.controller';

@Module({ controllers: [ResetController] })
export class ResetModule {}
`;
fs.writeFileSync(home + '/employee-tracker/apps/backend/src/reset/reset.module.ts', resetModule);

// 3. Add to app.module.ts
let appModule = fs.readFileSync(home + '/employee-tracker/apps/backend/src/app.module.ts', 'utf8');
if (!appModule.includes('ResetModule')) {
  appModule = appModule.replace(
    `import { HealthModule }`,
    `import { ResetModule } from './reset/reset.module';\nimport { HealthModule }`
  );
  appModule = appModule.replace(
    `HealthModule,`,
    `ResetModule,\n    HealthModule,`
  );
  fs.writeFileSync(home + '/employee-tracker/apps/backend/src/app.module.ts', appModule);
}

console.log('✓ Backend reset endpoint created');

// 4. Add reset button to settings page
let settings = fs.readFileSync(home + '/employee-tracker/apps/frontend/app/dashboard/settings/page.tsx', 'utf8');
if (!settings.includes('resetAll')) {
  // Add state and function
  settings = settings.replace(
    `export default function SettingsPage()`,
    `export default function SettingsPage()`
  );
  
  const resetSection = `
      {/* Reset Section */}
      <div style={{ background:'var(--bg-primary)', border:'1px solid #fee2e2', borderRadius:'var(--radius)', padding:'20px', marginTop:'16px' }}>
        <h2 style={{ fontSize:'14px', fontWeight:600, color:'#ef4444', margin:'0 0 8px' }}>⚠️ Опасная зона — Сброс данных</h2>
        <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'0 0 16px' }}>
          Удаляет все данные активности, задачи, аналитику и статистику. Структура системы сохраняется. Используется только для тестирования.
        </p>
        <button
          onClick={async () => {
            if (!confirm('Вы уверены? Это удалит ВСЕ данные: активность, задачи, аналитику, время работы. Действие необратимо!')) return;
            if (!confirm('Подтвердите ещё раз — все данные будут удалены безвозвратно.')) return;
            const t = localStorage.getItem('access_token');
            const res = await fetch('https://employee-tracker.ru/api/v1/reset', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + t },
            });
            const data = await res.json();
            if (data.success) alert('✅ Все данные успешно очищены!');
            else alert('Ошибка: ' + JSON.stringify(data));
          }}
          style={{ background:'#ef4444', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer' }}
        >
          🗑️ Очистить все данные
        </button>
      </div>`;

  // Insert before last closing div
  settings = settings.replace(
    /(\s*<\/div>\s*\);\s*}?\s*$)/,
    resetSection + '\n$1'
  );
  
  fs.writeFileSync(home + '/employee-tracker/apps/frontend/app/dashboard/settings/page.tsx', settings);
}

console.log('✓ Frontend reset button added');
console.log('✅ Done');
