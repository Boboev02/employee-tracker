import {
  Controller, Post, Get, Delete, Param, UseInterceptors,
  UploadedFile, HttpCode, UseGuards, NotFoundException,
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
    const task = await this.prisma.task.findFirst({ where: { id: taskId, orgId: user.orgId, deletedAt: null } });
    if (!task) {
      if (file && existsSync(file.path)) unlinkSync(file.path);
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskAttachment.create({
      data: {
        taskId,
        orgId: user.orgId,
        uploadedById: user.id ?? user.sub,
        fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        fileSize: file.size,
        mimeType: file.mimetype,
        url: '/api/v1/uploads/' + file.filename,
      },
    });
  }

  @Get()
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  async getAttachments(@CurrentUser() user: any, @Param('taskId') taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, orgId: user.orgId } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.taskAttachment.findMany({
      where: { taskId, orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('task:update:any', 'task:update:self')
  async deleteAttachment(
    @CurrentUser() user: any,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
  ) {
    const att = await this.prisma.taskAttachment.findFirst({
      where: { id, taskId, orgId: user.orgId },
    });
    if (!att) throw new NotFoundException('Attachment not found');

    const filename = att.url.split('/').pop();
    const filePath = join(UPLOAD_DIR, filename ?? '');
    if (filePath && existsSync(filePath)) unlinkSync(filePath);

    await this.prisma.taskAttachment.delete({ where: { id } });
  }
}
