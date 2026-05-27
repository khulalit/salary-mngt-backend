import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';

describe('InsightsService', () => {
    let service: InsightsService;
    let prisma: PrismaService;

    const mockPrisma = {
        employee: {
            count: jest.fn(),
            aggregate: jest.fn(),
            groupBy: jest.fn(),
        },
    } as any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [InsightsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<InsightsService>(InsightsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return global insights', async () => {
        mockPrisma.employee.count.mockResolvedValue(10000);
        mockPrisma.employee.aggregate
            .mockResolvedValueOnce({ _sum: { salary: 927521000 } }) // total payroll
            .mockResolvedValueOnce({ _avg: { salary: 92752 } }); // avg salary

        const result = await service.getGlobalInsights();
        expect(mockPrisma.employee.count).toHaveBeenCalled();
        expect(mockPrisma.employee.aggregate).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
            totalCount: 10000,
            totalPayroll: 927521000,
            avgSalary: 92752,
        });
    });

    it('should return country insights', async () => {
        const mockData = [
            {
                country: 'USA',
                _count: { _all: 1420 },
                _min: { salary: 62000 },
                _max: { salary: 198000 },
                _avg: { salary: 118500 },
                _sum: { salary: 168270000 },
            },
        ];
        mockPrisma.employee.groupBy.mockResolvedValue(mockData);

        const result = await service.getCountryInsights();
        expect(mockPrisma.employee.groupBy).toHaveBeenCalledWith({
            by: ['country'],
            _count: { _all: true },
            _min: { salary: true },
            _max: { salary: true },
            _avg: { salary: true },
            _sum: { salary: true },
        });
        expect(result).toEqual([
            {
                country: 'USA',
                headcount: 1420,
                minSalary: 62000,
                maxSalary: 198000,
                avgSalary: 118500,
                totalPayroll: 168270000,
            },
        ]);
    });

    it('should return job title insights', async () => {
        const mockData = [
            {
                jobTitle: 'Engineer',
                _count: { _all: 450 },
                _min: { salary: 60000 },
                _max: { salary: 120000 },
                _avg: { salary: 90000 },
            },
        ];
        mockPrisma.employee.groupBy.mockResolvedValue(mockData);

        const result = await service.getJobTitleInsights();
        expect(mockPrisma.employee.groupBy).toHaveBeenCalledWith({
            by: ['jobTitle'],
            _count: { _all: true },
            _min: { salary: true },
            _max: { salary: true },
            _avg: { salary: true },
        });
        expect(result).toEqual([
            {
                jobTitle: 'Engineer',
                headcount: 450,
                minSalary: 60000,
                maxSalary: 120000,
                avgSalary: 90000,
            },
        ]);
    });

    it('should return all insights', async () => {
        jest.spyOn(service, 'getGlobalInsights').mockResolvedValue({ totalCount: 1, totalPayroll: 1000, avgSalary: 1000 });
        jest.spyOn(service, 'getCountryInsights').mockResolvedValue([] as any);
        jest.spyOn(service, 'getJobTitleInsights').mockResolvedValue([] as any);

        const result = await service.getAllInsights();
        expect(result).toEqual({
            global: { totalCount: 1, totalPayroll: 1000, avgSalary: 1000 },
            byCountry: [],
            byJobTitle: [],
        });
    });
});
