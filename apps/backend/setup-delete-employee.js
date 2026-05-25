const fs = require('fs');

// ─── Backend: Add delete endpoint to employees controller ────
let controller = fs.readFileSync('src/employees/employees.controller.ts', 'utf8');
controller = controller.replace(
  `  @Patch(':id/activate')
  @RequirePermissions('user:suspend')
  activate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.activate(id, user.orgId);
  }
}`,
  `  @Patch(':id/activate')
  @RequirePermissions('user:suspend')
  activate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.activate(id, user.orgId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('user:delete')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.delete(id, user.orgId, user.id);
  }
}`
);
// Add Delete import
controller = controller.replace(
  `import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';`,
  `import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';`
);
fs.writeFileSync('src/employees/employees.controller.ts', controller);
console.log('✓ employees.controller.ts updated');

// ─── Add delete method to employees service ──────────────────
let service = fs.readFileSync('src/employees/employees.service.ts', 'utf8');
service = service.replace(
  `  async activate(userId: string, orgId: string) {
    await this.prisma.user.updateMany({ where: { id: userId, orgId }, data: { status: 'ACTIVE' } });
    return { message: 'Activated' };
  }
}`,
  `  async activate(userId: string, orgId: string) {
    await this.prisma.user.updateMany({ where: { id: userId, orgId }, data: { status: 'ACTIVE' } });
    return { message: 'Activated' };
  }

  async delete(userId: string, orgId: string, requesterId: string) {
    if (userId === requesterId) {
      throw new Error('Cannot delete yourself');
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId } });
    if (!user) throw new Error('Employee not found');

    // Soft delete
    await this.prisma.user.update({
      where: { id: userId },
      data:  { deletedAt: new Date(), status: 'SUSPENDED' },
    });
    // Remove sessions
    await this.prisma.session.deleteMany({ where: { userId } });
    // Remove from teams
    await this.prisma.teamMember.updateMany({
      where: { userId, leftAt: null },
      data:  { leftAt: new Date() },
    });
    return { message: 'Deleted' };
  }
}`,
);
// Add NotFoundException if needed
if (!service.includes('ForbiddenException')) {
  service = service.replace(
    `import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';`,
    `import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';`
  );
}
fs.writeFileSync('src/employees/employees.service.ts', service);
console.log('✓ employees.service.ts updated');

console.log('\n✅ Delete employee backend done');
