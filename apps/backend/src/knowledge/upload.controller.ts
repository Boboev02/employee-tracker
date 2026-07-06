import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/index';
import * as path from 'path';
import * as crypto from 'crypto';

@Controller('api/v1/upload')
@UseGuards(JwtAuthGuard)
export class UploadController {

  @Post('file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: '/opt/employee-tracker/uploads',
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = crypto.randomUUID() + ext;
        cb(null, name);
      },
    }),
    fileFilter: (req, file, cb) => {
      // Блок-лист: запрещаем только потенциально опасные исполняемые типы.
      // Остальное (документы, изображения, видео, аудио, архивы) разрешено — как в мессенджере.
      const blocked = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.scr', '.com', '.jar', '.app', '.php', '.js', '.vbs', '.ps1'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (blocked.includes(ext)) {
        cb(new BadRequestException('Недопустимый тип файла'), false);
      } else {
        cb(null, true);
      }
    },
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  }))
  uploadFile(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Файл не загружен');
    return {
      url: 'https://employee-tracker.ru/uploads/' + file.filename,
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      fileType: path.extname(file.originalname).toLowerCase().replace('.', ''),
      size: file.size,
    };
  }
}
