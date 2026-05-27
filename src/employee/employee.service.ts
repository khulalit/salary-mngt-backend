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
        const data = {
            fullName: dto.fullName,
            email: dto.email,
            jobTitle: dto.jobTitle,
            country: dto.country,
            salary: dto.salary,
            department: dto.department,
            hireDate: new Date(),
        } as any;
        try {
            return await this.prisma.employee.create({ data });
        } catch (error) {
            // Prisma unique constraint violation (code P2002)
            if (error?.code === 'P2002' && error?.meta?.target?.includes('email')) {
                throw new ConflictException('User already exists');
            }
            throw error;
        }
    }
}
