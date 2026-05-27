import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeeService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(page: number = 1, limit: number = 20, filters?: { name?: string; email?: string; jobTitle?: string; country?: string; department?: string; }) {
        const skip = (page - 1) * limit;
        const where: any = {};
        if (filters) {
            if (filters.name) {
                where.fullName = { contains: filters.name };
            }
            if (filters.email) {
                where.email = { contains: filters.email };
            }
            if (filters.jobTitle) {
                where.jobTitle = { contains: filters.jobTitle };
            }
            if (filters.country) {
                where.country = { equals: filters.country };
            }
            if (filters.department) {
                where.department = { equals: filters.department };
            }
        }
        return this.prisma.employee.findMany({ skip, take: limit, where });
    }

    async create(dto: CreateEmployeeDto) {

        return {}
    }
}
