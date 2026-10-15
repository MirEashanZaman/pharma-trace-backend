import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { EpcisQueryService } from './epcis-query.service';
import { EpcisQueryParametersDto } from './epcis-query.dto';

@Controller('epcis')
export class EpcisQueryController {
  constructor(private readonly epcisQueryService: EpcisQueryService) {}

  @Get('events')
  queryEvents(
    @Query() query: EpcisQueryParametersDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.epcisQueryService.queryEvents(query);

    res.setHeader('GS1-EPCIS-Version', '2.0');
    res.setHeader('GS1-EPCIS-Min', '2.0');
    res.setHeader('GS1-EPCIS-Max', '2.0');
    res.setHeader('GS1-CBV-Version', '2.0');
    res.setHeader('GS1-CBV-Min', '2.0');
    res.setHeader('GS1-CBV-Max', '2.0');
    res.setHeader('GS1-Extensions', '["https://pharmatrace.org/epcis/extensions/v1"]');
    res.setHeader('Content-Type', 'application/ld+json');

    if (result.nextPageToken) {
      res.setHeader('Link', `</epcis/events?nextPageToken=${result.nextPageToken}>; rel="next"`);
    }

    return result.document;
  }

  @Get('events/:eventID')
  getEventById(
    @Param('eventID') eventID: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const event = this.epcisQueryService.getEventById(eventID);
    res.setHeader('GS1-EPCIS-Version', '2.0');
    res.setHeader('GS1-CBV-Version', '2.0');
    res.setHeader('Content-Type', 'application/ld+json');
    return event;
  }

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  captureEventsDirect(
    @Body() payload: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.handleCapture(payload, res);
  }

  @Post('capture')
  @HttpCode(HttpStatus.CREATED)
  captureEventsJob(
    @Body() payload: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.handleCapture(payload, res);
  }

  private handleCapture(payload: any, res: Response) {
    const job = this.epcisQueryService.capture(payload);
    res.setHeader('GS1-EPCIS-Version', '2.0');
    res.setHeader('GS1-CBV-Version', '2.0');
    res.setHeader('GS1-Capture-Error-Count', '0');
    res.setHeader('Location', `/epcis/capture/${job.captureID}`);
    return job;
  }

  @Get('epcis-version')
  getEpcisVersion(@Res({ passthrough: true }) res: Response) {
    res.setHeader('GS1-EPCIS-Version', '2.0');
    return this.epcisQueryService.getEpcisVersion();
  }

  @Get('openapi.json')
  getOpenApiSpec() {
    return this.epcisQueryService.getOpenApiSpec();
  }
}
