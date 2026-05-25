const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Add refresh endpoint to auth controller ─────────────────
write('src/auth/auth.controller.ts', `import { Controller, Post, Get, Body, Req, Res, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from './decorators/index';
import { TokenService } from './token.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() body: { email: string; password: string; name: string; orgName?: string }) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }, @Req() req: Request, @Res() res: Response) {
    const result = await this.auth.login(body.email, body.password, req.ip, req.headers['user-agent']);
    return res.json(result);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@CurrentUser() user: any) {
    const accessToken = this.tokens.generateAccessToken({
      sub: user.id ?? user.sub,
      email: user.email,
      orgId: user.orgId,
    });
    return { accessToken, expiresIn: 900 };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    const token = req.headers.authorization?.slice(7) ?? '';
    if (user) await this.auth.logout(user.id, token);
    return res.status(204).send();
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.auth.getMe(user.id ?? user.sub);
  }
}
`);

// ─── Seed script for test employees ──────────────────────────
write('scripts/seed-employees.ts', `import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const EMPLOYEES = [
  { name: 'Иван Петров',    email: 'ivan@test.ru',    role: 'MANAGER',  platform: 'WILDBERRIES' },
  { name: 'Анна Сидорова',  email: 'anna@test.ru',    role: 'EMPLOYEE', platform: 'OZON' },
  { name: 'Дмитрий Козлов', email: 'dmitry@test.ru',  role: 'EMPLOYEE', platform: 'WILDBERRIES' },
  { name: 'Мария Новикова', email: 'maria@test.ru',   role: 'VIEWER',   platform: 'OZON' },
];

async function seed() {
  // Get org
  const org = await prisma.organisation.findFirst();
  if (!org) { console.error('No org found'); process.exit(1); }

  console.log('Seeding employees for org:', org.name);

  for (const emp of EMPLOYEES) {
    const exists = await prisma.user.findUnique({ where: { email: emp.email } });
    if (exists) { console.log('Skip (exists):', emp.email); continue; }

    const hash = await bcrypt.hash('password123', 12);
    let role = await prisma.role.findUnique({ where: { name: emp.role } });
    if (!role) role = await prisma.role.create({ data: { name: emp.role, permissions: [] } });

    const user = await prisma.user.create({
      data: { email: emp.email, name: emp.name, password: hash, orgId: org.id },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    // Seed some activity events for this user (last 7 days)
    const events = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      const eventsPerDay = Math.floor(Math.random() * 80) + 20;

      for (let i = 0; i < eventsPerDay; i++) {
        const hour = Math.floor(Math.random() * 9) + 9; // 9-18
        const eventDate = new Date(date);
        eventDate.setHours(hour, Math.floor(Math.random() * 60));

        events.push({
          eventId:         crypto.randomUUID(),
          batchId:         crypto.randomUUID(),
          userId:          user.id,
          orgId:           org.id,
          eventType:       ['click','keydown','scroll','page_load','heartbeat'][Math.floor(Math.random()*5)],
          platform:        emp.platform,
          url:             emp.platform === 'WILDBERRIES' ? 'https://seller.wildberries.ru/orders' : 'https://seller.ozon.ru/app/orders',
          platformData:    { section: ['orders','products','analytics','finance'][Math.floor(Math.random()*4)] },
          clientTimestamp: eventDate,
          createdAt:       eventDate,
        });
      }
    }

    await prisma.activityEvent.createMany({ data: events, skipDuplicates: true });
    console.log('Created:', emp.name, '—', events.length, 'events');
  }

  console.log('Done!');
  await prisma.$disconnect();
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
`);

console.log('\n✅ Final setup files created');
console.log('\nNext: npx ts-node scripts/seed-employees.ts');
