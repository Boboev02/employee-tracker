import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { SubscriberController } from './subscriber.controller';
import { SubscriberService } from './subscriber.service';
import { SubscriberAutomationService } from './subscriber-automation.service';
import { SubscriberAutomationController } from './subscriber-automation.controller';
import { SubscriberDashboardService } from './subscriber-dashboard.service';
import { SubscriberDashboardController } from './subscriber-dashboard.controller';
import { SubscriberSettingsService } from './subscriber-settings.service';
import { SubscriberSettingsController } from './subscriber-settings.controller';
import { TelegramNotifyService } from './telegram-notify.service';

@Module({
  imports: [NotificationModule],
  controllers: [
    SubscriberController, SubscriberAutomationController,
    SubscriberDashboardController, SubscriberSettingsController,
  ],
  providers: [
    SubscriberService, SubscriberAutomationService,
    SubscriberDashboardService, SubscriberSettingsService,
    TelegramNotifyService,
  ],
  exports: [SubscriberService, SubscriberAutomationService, SubscriberDashboardService, SubscriberSettingsService],
})
export class SubscriberModule {}
