import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let prisma: PrismaService;

  const mockPrisma = {
    employee: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated employees without filters', async () => {
    const dummy = [{ id: 1, fullName: 'John Doe' }];
    mockPrisma.employee.findMany.mockResolvedValue(dummy);
    const result = await service.findAll(2, 10);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      where: {},
    });
    expect(result).toBe(dummy);
  });

  it('should apply filters when provided', async () => {
    const dummy = [{ id: 2, fullName: 'Jane Smith' }];
    mockPrisma.employee.findMany.mockResolvedValue(dummy);
    const filters = { name: 'Jane', email: 'jane@example.com' } as any;
    await service.findAll(1, 20, filters);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      where: {
        fullName: { contains: 'Jane' },
        email: { contains: 'jane@example.com' },
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
    } as any;
    const created = { id: 3, ...dto } as any;
    mockPrisma.employee.create.mockResolvedValue(created);
    const result = await service.create(dto);
    expect(mockPrisma.employee.create).toHaveBeenCalledWith({ data: expect.objectContaining(dto) });
    expect(result).toBe(created);
  });

  it('should throw ConflictException on duplicate email', async () => {
    const dto: CreateEmployeeDto = {
      fullName: 'Bob',
      email: 'bob@example.com',
      jobTitle: 'Engineer',
      country: 'USA',
      salary: 80000,
      department: 'Engineering',
    } as any;
    const prismaError = { code: 'P2002', meta: { target: ['email'] } } as any;
    mockPrisma.employee.create.mockRejectedValue(prismaError);
    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    await expect(service.create(dto)).rejects.toMatchObject({
      message: 'User already exists',
    });
  });
});
