import { Module } from '@nestjs/common';
import { InsightsService } from './insight.service';
import { InsightsController } from './insights.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    providers: [InsightsService, PrismaService],
    controllers: [InsightsController],
})
export class InsightsModule { }
