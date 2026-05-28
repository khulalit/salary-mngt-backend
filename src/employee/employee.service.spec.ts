import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

import { EmployeeService } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

describe('EmployeeService', () => {
  let service: EmployeeService;

  const mockPrisma = {
    employee: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated employees without filters', async () => {
    const dummy = [{ id: 1, fullName: 'John Doe' }];

    mockPrisma.employee.findMany.mockResolvedValue(dummy);
    mockPrisma.employee.count.mockResolvedValue(1);

    const result = await service.findAll(2, 10);

    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      where: {},
    });

    expect(mockPrisma.employee.count).toHaveBeenCalledWith({
      where: {},
    });

    expect(result).toEqual({
      data: dummy,
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
  });

  it('should apply filters when provided', async () => {
    const dummy = [{ id: 2, fullName: 'Jane Smith' }];

    mockPrisma.employee.findMany.mockResolvedValue(dummy);
    mockPrisma.employee.count.mockResolvedValue(1);

    const filters = {
      name: 'Jane',
      email: 'jane@example.com',
    };

    await service.findAll(1, 20, filters);

    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      where: {
        fullName: {
          contains: 'Jane',
        },
        email: {
          contains: 'jane@example.com',
        },
      },
    });

    expect(mockPrisma.employee.count).toHaveBeenCalledWith({
      where: {
        fullName: {
          contains: 'Jane',
        },
        email: {
          contains: 'jane@example.com',
        },
      },
    });
  });

  it('should create a new employee successfully', async () => {
    const dto: CreateEmployeeDto = {
      fullName: 'Alice Johnson',
      email: 'alice@example.com',
      jobTitle: 'Engineer',
      country: 'USA',
      salary: 90000,
      department: 'Engineering',
    };

    const created = {
      id: 3,
      ...dto,
    };

    mockPrisma.employee.create.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(mockPrisma.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining(dto),
    });

    expect(result).toEqual(created);
  });

  it('should throw ConflictException on duplicate email', async () => {
    const dto: CreateEmployeeDto = {
      fullName: 'Bob',
      email: 'bob@example.com',
      jobTitle: 'Engineer',
      country: 'USA',
      salary: 80000,
      department: 'Engineering',
    };

    const prismaError = {
      code: 'P2002',
      meta: {
        target: ['email'],
      },
    };

    mockPrisma.employee.create.mockRejectedValue(prismaError);

    await expect(service.create(dto)).rejects.toThrow(ConflictException);

    await expect(service.create(dto)).rejects.toMatchObject({
      message: 'User already exists',
    });
  });
});
