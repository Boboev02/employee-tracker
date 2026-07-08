import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { SubscriberController } from './subscriber.controller';
import { SubscriberService } from './subscriber.service';
import { SubscriberAutomationService } from './subscriber-automation.service';
import { SubscriberAutomationController } from './subscriber-automation.controller';
import { SubscriberDashboardService } from './subscriber-dashboard.service';
import { SubscriberDashboardController } from './subscriber-dashboard.controller';

@Module({
  imports: [NotificationModule],
  controllers: [SubscriberController, SubscriberAutomationController, SubscriberDashboardController],
  providers: [SubscriberService, SubscriberAutomationService, SubscriberDashboardService],
  exports: [SubscriberService, SubscriberAutomationService, SubscriberDashboardService],
})
export class SubscriberModule {}
