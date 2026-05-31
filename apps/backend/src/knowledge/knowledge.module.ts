import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { UploadController } from './upload.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [PrismaModule, MulterModule.register()],
  controllers: [KnowledgeController, UploadController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
