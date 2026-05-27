import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 20, filters?: { name?: string; email?: string; jobTitle?: string; country?: string; department?: string; }) {
   
    return [];
  }

    async create(dto: CreateEmployeeDto) {
        
        return {}
    }
}
