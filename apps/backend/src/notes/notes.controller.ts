
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/guards/index';

@Controller('api/v1/notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly svc: NotesService) {}

  @Get()
  list(@Request() req: any, @Query('status') status?: string, @Query('search') search?: string) {
    return this.svc.list(req.user.id, req.user.orgId, status, search);
  }

  @Post()
  create(@Request() req: any, @Body() dto: any) {
    return this.svc.create(req.user.id, req.user.orgId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: any) {
    return this.svc.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.svc.remove(id, req.user.id);
  }
}
