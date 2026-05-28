import { Controller, Get, UseGuards } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HR_MANAGER')
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

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
