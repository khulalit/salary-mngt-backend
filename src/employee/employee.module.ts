import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [EmployeeService, PrismaService],
  controllers: [EmployeeController],
})
export class EmployeeModule {}
