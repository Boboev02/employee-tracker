import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AttachmentsController } from './attachments.controller';

@Module({
  imports: [MulterModule.register({ dest: '/app/uploads' })],
  controllers: [AttachmentsController],
})
export class AttachmentsModule {}
