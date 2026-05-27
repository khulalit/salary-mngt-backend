import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';


describe('InsightsController (e2e)', () => {
    let app: INestApplication;
    const mockService = {
        getGlobalInsights: jest.fn(),
        getCountryInsights: jest.fn(),
        getJobTitleInsights: jest.fn(),
        getAllInsights: jest.fn(),
    } as any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [InsightsController],
            providers: [{ provide: InsightsService, useValue: mockService }],
        })
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

    it('/insights/global (GET) should return global insights', async () => {
        const dummy = { totalCount: 10000, totalPayroll: 927521000, avgSalary: 92752 };
        mockService.getGlobalInsights.mockResolvedValue(dummy);

        await request(app.getHttpServer())
            .get('/insights/global')
            .expect(200)
            .expect(dummy);

        expect(mockService.getGlobalInsights).toHaveBeenCalled();
    });

    it('/insights/countries (GET) should return country insights', async () => {
        const dummy = [{ country: 'USA', headcount: 1420, minSalary: 62000, maxSalary: 198000, avgSalary: 118500, totalPayroll: 168270000 }];
        mockService.getCountryInsights.mockResolvedValue(dummy);

        await request(app.getHttpServer())
            .get('/insights/countries')
            .expect(200)
            .expect(dummy);

        expect(mockService.getCountryInsights).toHaveBeenCalled();
    });

    it('/insights/jobtitles (GET) should return job title insights', async () => {
        const dummy = [{ jobTitle: 'Engineer', headcount: 450, minSalary: 60000, maxSalary: 130000, avgSalary: 96000 }];
        mockService.getJobTitleInsights.mockResolvedValue(dummy);

        await request(app.getHttpServer())
            .get('/insights/jobtitles')
            .expect(200)
            .expect(dummy);

        expect(mockService.getJobTitleInsights).toHaveBeenCalled();
    });

    it('/insights (GET) should return all insights', async () => {
        const dummy = {
            global: { totalCount: 10000, totalPayroll: 927521000, avgSalary: 92752 },
            byCountry: [],
            byJobTitle: [],
        };
        mockService.getAllInsights.mockResolvedValue(dummy);

        await request(app.getHttpServer())
            .get('/insights')
            .expect(200)
            .expect(dummy);

        expect(mockService.getAllInsights).toHaveBeenCalled();
    });
});
