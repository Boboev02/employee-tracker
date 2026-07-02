import {
  Controller, Post, Get, Delete, Param, UseInterceptors,
  UploadedFile, HttpCode, UseGuards, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = '/app/uploads';

@Controller('api/v1/tasks/:taskId/attachments')
@UseGuards(RbacGuard)
export class AttachmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @RequirePermissions('task:update:any', 'task:update:self')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: (req, file, cb) => {
        const ext = extname(file.originalname);
        cb(null, uuid() + ext);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  async upload(
    @CurrentUser() user: any,
    @Param('taskId') taskId: string,
    @UploadedFile() file: any,
  ) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, orgId: user.orgId } });
    if (!task) { if (existsSync(file.path)) unlinkSync(file.path); return { error: 'Task not found' }; }

    const attachment = await this.prisma.$queryRaw`
      INSERT INTO "TaskAttachment" (id, "taskId", "orgId", "uploadedById", "fileName", "fileSize", "mimeType", url, "createdAt")
      VALUES (${uuid()}, ${taskId}, ${user.orgId}, ${user.id ?? user.sub}, ${file.originalname}, ${file.size}, ${file.mimetype}, ${'/api/v1/uploads/' + file.filename}, NOW())
      RETURNING *
    `;
    return (attachment as any[])[0];
  }

  @Get()
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  async getAttachments(@CurrentUser() user: any, @Param('taskId') taskId: string) {
    return this.prisma.$queryRaw`
      SELECT * FROM "TaskAttachment" WHERE "taskId" = ${taskId} ORDER BY "createdAt" DESC
    `;
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('task:update:any', 'task:update:self')
  async deleteAttachment(@CurrentUser() user: any, @Param('taskId') taskId: string, @Param('id') id: string) {
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT * FROM "TaskAttachment" WHERE id = ${id} AND "taskId" = ${taskId}
    `;
    if (!rows.length) return;
    const att = rows[0];
    const filePath = join(UPLOAD_DIR, att.url.split('/').pop());
    if (existsSync(filePath)) unlinkSync(filePath);
    await this.prisma.$queryRaw`DELETE FROM "TaskAttachment" WHERE id = ${id}`;
  }
}
