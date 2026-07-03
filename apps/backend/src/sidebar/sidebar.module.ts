import { Module } from '@nestjs/common';
import { SidebarController } from './sidebar.controller';

@Module({
  controllers: [SidebarController],
})
export class SidebarModule {}
