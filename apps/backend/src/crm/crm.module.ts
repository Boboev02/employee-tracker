import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmAutomationService } from './crm-automation.service';
import { CrmAutomationController } from './crm-automation.controller';
import { CrmCaseService } from './crm-case.service';
import { CrmCaseController } from './crm-case.controller';
import { CrmDocumentService } from './crm-document.service';
import { CrmDocumentController } from './crm-document.controller';
import { CrmWebFormService } from './crm-webform.service';
import { CrmWebFormController } from './crm-webform.controller';
import { CrmEmailService } from './crm-email.service';
import { CrmEmailController } from './crm-email.controller';

@Module({
  imports: [NotificationModule],
  controllers: [
    CrmController, CrmAutomationController, CrmCaseController,
    CrmDocumentController, CrmWebFormController, CrmEmailController,
  ],
  providers: [
    CrmService, CrmAutomationService, CrmCaseService,
    CrmDocumentService, CrmWebFormService, CrmEmailService,
  ],
  exports: [CrmService, CrmAutomationService],
})
export class CrmModule {}
