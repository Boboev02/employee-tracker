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
      const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg', '.webm', '.ogg', '.mp3', '.wav', '.m4a'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Недопустимый тип файла'), false);
      }
    },
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
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
