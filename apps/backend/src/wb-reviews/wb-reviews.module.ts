import { Module } from '@nestjs/common';
import { WbReviewsController } from './wb-reviews.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [WbReviewsController],
})
export class WbReviewsModule {}
