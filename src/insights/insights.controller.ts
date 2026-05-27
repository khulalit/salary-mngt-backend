import { Controller, Get } from '@nestjs/common';
import { InsightsService } from './insight.service';

@Controller('insights')
export class InsightsController {
    constructor(private readonly insightsService: InsightsService) { }

    @Get('global')
    async getGlobal() {
        return this.insightsService.getGlobalInsights();
    }

    @Get('countries')
    async getByCountry() {
        return this.insightsService.getCountryInsights();
    }

    @Get('jobtitles')
    async getByJobTitle() {
        return this.insightsService.getJobTitleInsights();
    }

    @Get()
    async getAll() {
        return this.insightsService.getAllInsights();
    }
}
