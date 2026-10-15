import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DigitalLinkService, Gs1LinksetResponse, Gs1ParsedElements } from './digital-link.service';

export class ParseUriDto {
  uri!: string;
}

export class BuildUriDto {
  gtin!: string;
  serialNumber!: string;
  batchNumber?: string;
  expirationDate?: string;
}

@Controller('blockchain/gs1')
export class DigitalLinkController {
  constructor(private readonly digitalLinkService: DigitalLinkService) {}

  @Get('resolve/:gtin/:serial')
  async resolveLink(
    @Param('gtin') gtin: string,
    @Param('serial') serial: string,
  ): Promise<Gs1LinksetResponse> {
    return this.digitalLinkService.resolveDigitalLink(gtin, serial);
  }

  @Post('parse')
  async parseUri(@Body() body: any): Promise<Gs1ParsedElements> {
    return this.digitalLinkService.parseGs1Uri(body.uri);
  }

  @Post('build')
  async buildUri(@Body() body: any): Promise<{ canonicalUri: string }> {
    const canonicalUri = this.digitalLinkService.buildCanonicalUri(
      body.gtin,
      body.serialNumber,
      body.batchNumber,
      body.expirationDate,
    );
    return { canonicalUri };
  }
}
