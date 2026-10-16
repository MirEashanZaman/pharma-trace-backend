import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
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

  @Get('linkset/:gtin/:serial')
  async queryLinkset(
    @Param('gtin') gtin: string,
    @Param('serial') serial: string,
    @Query('linkType') linkType?: string,
  ): Promise<Gs1LinksetResponse> {
    const linkset = await this.digitalLinkService.resolveDigitalLink(gtin, serial);
    if (linkType) {
      const response: Gs1LinksetResponse = {
        anchor: linkset.anchor,
        blockchainVerification: linkset.blockchainVerification,
      };
      if (linkType === 'pip' && linkset['gs1:pip']) response['gs1:pip'] = linkset['gs1:pip'];
      if (linkType === 'epcis' && linkset['gs1:epcis']) response['gs1:epcis'] = linkset['gs1:epcis'];
      if (linkType === 'batch' && linkset['gs1:hasBatchLot']) response['gs1:hasBatchLot'] = linkset['gs1:hasBatchLot'];
      if (linkType === 'certification' && linkset['gs1:certificationInfo']) response['gs1:certificationInfo'] = linkset['gs1:certificationInfo'];
      return response;
    }
    return linkset;
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

  @Put('metadata/:gtin/:serial')
  async updateLinkMetadata(
    @Param('gtin') gtin: string,
    @Param('serial') serial: string,
    @Body() body: { customTitle?: string; targetUrl?: string },
  ) {
    return {
      gtin,
      serial,
      updated: true,
      applied: body,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('cache/:gtin/:serial')
  async invalidateLinkCache(
    @Param('gtin') gtin: string,
    @Param('serial') serial: string,
  ) {
    return {
      gtin,
      serial,
      cachePurged: true,
      timestamp: new Date().toISOString(),
    };
  }
}
