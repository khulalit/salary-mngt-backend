import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InsightsService {
    // Keeping the constructor so your test setup (module mocking) works seamlessly
    constructor(private readonly prisma: PrismaService) { }

    async getGlobalInsights() {
        const totalCount = await this.prisma.employee.count();
        const totalPayroll = await this.prisma.employee.aggregate({
            _sum: { salary: true },
        });
        const avgSalary = await this.prisma.employee.aggregate({
            _avg: { salary: true },
        });

        return {
            totalCount,
            totalPayroll: totalPayroll._sum.salary ?? 0,
            avgSalary: Math.round((avgSalary._avg.salary ?? 0) * 100) / 100,
        };
    }

    async getCountryInsights() {
        const result = await this.prisma.employee.groupBy({
            by: ['country'],
            _count: { _all: true },
            _min: { salary: true },
            _max: { salary: true },
            _avg: { salary: true },
            _sum: { salary: true },
        });
        return result.map(r => ({
            country: r.country,
            headcount: r._count._all,
            minSalary: r._min.salary ?? 0,
            maxSalary: r._max.salary ?? 0,
            avgSalary: Math.round((r._avg.salary ?? 0) * 100) / 100,
            totalPayroll: r._sum.salary ?? 0,
        }));
    }

    async getJobTitleInsights(): Promise<any[]> {
        // TODO: Implement after writing tests
        return [];
    }

    async getAllInsights(): Promise<any> {
        // TODO: Implement after writing tests
        return null as any;
    }
}