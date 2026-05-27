import { Controller, Get, Post, Body, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  async getAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('jobTitle') jobTitle?: string,
    @Query('country') country?: string,
    @Query('department') department?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    if (pageNum < 1) {
      throw new BadRequestException('page must be greater than 1');
    }
    if (limitNum < 1) {
      throw new BadRequestException('limit must be greater than 0');
    }
    if (limitNum > 100) {
      throw new BadRequestException('limit cannot be greater than 100');
    }

    const filters = { name, email, jobTitle, country, department };
    return this.employeeService.findAll(pageNum, limitNum, filters);
  }

  @Post()
  async create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }
}
