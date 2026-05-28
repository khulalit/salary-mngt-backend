import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeeModule } from './employee/employee.module';
import { InsightsModule } from './insights/insights.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, EmployeeModule, InsightsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
