import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException } from '@nestjs/common';

import request from 'supertest';

import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';

describe('EmployeeController (e2e)', () => {
  let app: INestApplication;

  const mockService = {
    findAll: jest.fn(),
    create: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [
        {
          provide: EmployeeService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../auth/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('/employees (GET) should return paginated list', async () => {
    const response = {
      data: [
        {
          id: 1,
          fullName: 'John Doe',
        },
      ],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    };

    mockService.findAll.mockResolvedValue(response);

    await request(app.getHttpServer())
      .get('/employees?page=2&limit=5')
      .expect(200)
      .expect(response);

    expect(mockService.findAll).toHaveBeenCalledWith(2, 5, {});
  });

  it('/employees (GET) should forward filters', async () => {
    const response = {
      data: [
        {
          id: 2,
          fullName: 'Jane Smith',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    mockService.findAll.mockResolvedValue(response);

    await request(app.getHttpServer())
      .get('/employees?name=Jane&email=jane%40example.com')
      .expect(200)
      .expect(response);

    expect(mockService.findAll).toHaveBeenCalledWith(1, 20, {
      name: 'Jane',
      email: 'jane@example.com',
    });
  });

  it('/employees (GET) should validate page', async () => {
    await request(app.getHttpServer())
      .get('/employees?page=0')
      .expect(400)
      .expect({
        statusCode: 400,
        message: 'page must be a positive number',
        error: 'Bad Request',
      });
  });

  it('/employees (GET) should validate limit', async () => {
    await request(app.getHttpServer())
      .get('/employees?limit=0')
      .expect(400)
      .expect({
        statusCode: 400,
        message: 'limit must be a positive number',
        error: 'Bad Request',
      });
  });

  it('/employees (GET) should validate max limit', async () => {
    await request(app.getHttpServer())
      .get('/employees?limit=101')
      .expect(400)
      .expect({
        statusCode: 400,
        message: 'limit cannot exceed 100',
        error: 'Bad Request',
      });
  });

  it('/employees (POST) should create employee', async () => {
    const dto = {
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

    mockService.create.mockResolvedValue(created);

    await request(app.getHttpServer())
      .post('/employees')
      .send(dto)
      .expect(201)
      .expect(created);

    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('/employees (POST) should handle duplicate email', async () => {
    const dto = {
      fullName: 'Bob',
      email: 'bob@example.com',
      jobTitle: 'Engineer',
      country: 'USA',
      salary: 80000,
      department: 'Engineering',
    };

    mockService.create.mockRejectedValue(
      new ConflictException('User already exists'),
    );

    await request(app.getHttpServer()).post('/employees').send(dto).expect(409);

    expect(mockService.create).toHaveBeenCalledWith(dto);
  });
});
