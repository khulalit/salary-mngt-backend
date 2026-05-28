import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HR_MANAGER')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  async getAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('jobTitle') jobTitle?: string,
    @Query('country') country?: string,
    @Query('department') department?: string,
  ) {
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (Number.isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('page must be a positive number');
    }

    if (Number.isNaN(limitNum) || limitNum < 1) {
      throw new BadRequestException('limit must be a positive number');
    }

    if (limitNum > 100) {
      throw new BadRequestException('limit cannot exceed 100');
    }

    const filters = {
      ...(name && { name }),
      ...(email && { email }),
      ...(jobTitle && { jobTitle }),
      ...(country && { country }),
      ...(department && { department }),
    };

    return this.employeeService.findAll(pageNum, limitNum, filters);
  }

  @Post()
  async create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }
}
