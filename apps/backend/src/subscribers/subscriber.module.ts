import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { SubscriberController } from './subscriber.controller';
import { SubscriberService } from './subscriber.service';
import { SubscriberAutomationService } from './subscriber-automation.service';
import { SubscriberAutomationController } from './subscriber-automation.controller';

@Module({
  imports: [NotificationModule],
  controllers: [SubscriberController, SubscriberAutomationController],
  providers: [SubscriberService, SubscriberAutomationService],
  exports: [SubscriberService, SubscriberAutomationService],
})
export class SubscriberModule {}
