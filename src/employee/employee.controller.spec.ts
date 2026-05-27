import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException } from '@nestjs/common';
import request from 'supertest';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';

describe('EmployeeController (e2e)', () => {
    let app: INestApplication;
    let service: EmployeeService;

    const mockService = {
        findAll: jest.fn(),
        create: jest.fn(),
    } as any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [EmployeeController],
            providers: [{ provide: EmployeeService, useValue: mockService }],
        })

            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        service = moduleFixture.get<EmployeeService>(EmployeeService);
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('/employees (GET) should return paginated list', async () => {
        const dummy = [{ id: 1, fullName: 'John Doe' }];
        mockService.findAll.mockResolvedValue(dummy);
        return request(app.getHttpServer())
            .get('/employees?page=2&limit=5')
            .expect(200)
            .expect(dummy)
            .then(() => {
                expect(mockService.findAll).toHaveBeenCalledWith(2, 5, {});
            });
    });

    it('/employees (GET) should forward filters', async () => {
        const dummy = [{ id: 2, fullName: 'Jane Smith' }];
        mockService.findAll.mockResolvedValue(dummy);
        return request(app.getHttpServer())
            .get('/employees?name=Jane&email=jane%40example.com')
            .expect(200)
            .expect(dummy)
            .then(() => {
                expect(mockService.findAll).toHaveBeenCalledWith(1, 20, {
                    name: 'Jane',
                    email: 'jane@example.com',
                    jobTitle: undefined,
                    country: undefined,
                    department: undefined,
                });
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
        } as any;
        const created = { id: 3, ...dto } as any;
        mockService.create.mockResolvedValue(created);
        return request(app.getHttpServer())
            .post('/employees')
            .send(dto)
            .expect(201)
            .expect(created)
            .then(() => {
                expect(mockService.create).toHaveBeenCalledWith(dto);
            });
    });

    it('/employees (POST) should handle duplicate email', async () => {
        const dto = {
            fullName: 'Bob',
            email: 'bob@example.com',
            jobTitle: 'Engineer',
            country: 'USA',
            salary: 80000,
            department: 'Engineering',
        } as any;
        mockService.create.mockRejectedValue(new ConflictException('User already exists'));
        return request(app.getHttpServer())
            .post('/employees')
            .send(dto)
            .expect(409)
            .then(() => {
                expect(mockService.create).toHaveBeenCalledWith(dto);
            });
    });
});
