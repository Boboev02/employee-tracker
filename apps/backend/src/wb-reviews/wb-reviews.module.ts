import { Module } from '@nestjs/common';
import { WbReviewsController } from './wb-reviews.controller';

@Module({
  controllers: [WbReviewsController],
})
export class WbReviewsModule {}
