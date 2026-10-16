import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { EpcisJsonLdEvent, EpcisJsonLdService, EpcisDocument } from './epcis-jsonld.service';
import {
  EpcisQueryParametersDto,
  EpcisQueryDocument,
  EpcisCaptureJobResult,
} from './epcis-query.dto';

@Injectable()
export class EpcisQueryService {
  private readonly logger = new Logger(EpcisQueryService.name);
  private readonly eventStore: Map<string, EpcisJsonLdEvent & { eventID: string }> = new Map();

  constructor(private readonly jsonLdService: EpcisJsonLdService) {
    this.seedBaselineEnterpriseEvents();
  }

  private seedBaselineEnterpriseEvents(): void {
    const defaultBatchTime = new Date(Date.now() - 3600000 * 24);
    const commEvent = this.jsonLdService.buildCommissioningEvent({
      gtin: '00300018899201',
      serialNumbers: ['SN-2026-AMOX-001', 'SN-2026-AMOX-002'],
      locationGln: '0844514000100',
      readPointGln: '0844514000101',
      timestamp: defaultBatchTime,
    });
    this.ingestSingleEvent(commEvent);

    const aggEvent = this.jsonLdService.buildAggregationEvent({
      parentSscc: '003000188992000001',
      childEpcs: [
        'urn:epc:id:sgtin:00300018899201.SN-2026-AMOX-001',
        'urn:epc:id:sgtin:00300018899201.SN-2026-AMOX-002',
      ],
      locationGln: '0844514000100',
      readPointGln: '0844514000102',
      timestamp: new Date(defaultBatchTime.getTime() + 1800000),
    });
    this.ingestSingleEvent(aggEvent);

    const shipEvent = this.jsonLdService.buildShippingEvent({
      epcs: ['urn:epc:id:sscc:003000188992000001'],
      locationGln: '0844514000100',
      readPointGln: '0844514000103',
      orderReference: 'PO-PHARMA-2026-9901',
      timestamp: new Date(defaultBatchTime.getTime() + 3600000),
    });
    this.ingestSingleEvent(shipEvent);
  }

  private ingestSingleEvent(event: EpcisJsonLdEvent, customId?: string): string {
    const rawId =
      customId ||
      `urn:uuid:${createHash('sha256')
        .update(JSON.stringify(event) + Date.now().toString() + Math.random().toString())
        .digest('hex')
        .substring(0, 32)}`;
    const eventWithId: EpcisJsonLdEvent & { eventID: string } = {
      ...event,
      eventID: rawId,
    };
    this.eventStore.set(rawId, eventWithId);
    return rawId;
  }

  capture(payload: EpcisDocument | EpcisJsonLdEvent | EpcisJsonLdEvent[]): EpcisCaptureJobResult {
    let eventsToCapture: EpcisJsonLdEvent[] = [];

    if (Array.isArray(payload)) {
      eventsToCapture = payload;
    } else if ('epcisBody' in payload && payload.epcisBody?.eventList) {
      eventsToCapture = payload.epcisBody.eventList;
    } else if ('type' in payload && 'action' in payload) {
      eventsToCapture = [payload as EpcisJsonLdEvent];
    } else {
      throw new BadRequestException('Invalid EPCIS 2.0 capture payload');
    }

    const captureId = `urn:uuid:cap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    for (const evt of eventsToCapture) {
      this.ingestSingleEvent(evt);
    }

    this.logger.log(`Ingested ${eventsToCapture.length} EPCIS 2.0 events via capture job ${captureId}`);

    return {
      captureID: captureId,
      createdAt: new Date().toISOString(),
      eventCount: eventsToCapture.length,
      running: false,
      success: true,
      captureErrorCount: 0,
    };
  }

  queryEvents(params: EpcisQueryParametersDto): {
    document: EpcisQueryDocument;
    totalCount: number;
    nextPageToken?: string;
  } {
    let matched = Array.from(this.eventStore.values());

    if (params.EQ_bizStep) {
      const step = params.EQ_bizStep.toLowerCase();
      matched = matched.filter((e) => {
        const eventStep = (e.bizStep || '').toLowerCase();
        return eventStep === step || eventStep.endsWith(`:${step}`) || eventStep.includes(step);
      });
    }

    if (params.EQ_action) {
      const act = params.EQ_action.toUpperCase();
      matched = matched.filter((e) => (e.action || '').toUpperCase() === act);
    }

    if (params.EQ_disposition) {
      const disp = params.EQ_disposition.toLowerCase();
      matched = matched.filter((e) => {
        const eventDisp = (e.disposition || '').toLowerCase();
        return eventDisp === disp || eventDisp.endsWith(`:${disp}`) || eventDisp.includes(disp);
      });
    }

    if (params.EQ_readPoint) {
      const rp = params.EQ_readPoint.toLowerCase();
      matched = matched.filter((e) => (e.readPoint?.id || '').toLowerCase().includes(rp));
    }

    if (params.EQ_bizLocation) {
      const loc = params.EQ_bizLocation.toLowerCase();
      matched = matched.filter((e) => (e.bizLocation?.id || '').toLowerCase().includes(loc));
    }

    if (params.EQ_eventID) {
      matched = matched.filter((e) => e.eventID === params.EQ_eventID);
    }

    if (params.MATCH_parentID) {
      const parent = params.MATCH_parentID.toLowerCase();
      matched = matched.filter((e) => (e.parentID || '').toLowerCase().includes(parent));
    }

    if (params.MATCH_epc) {
      const targetEpc = params.MATCH_epc.toLowerCase();
      matched = matched.filter((e) => {
        if (e.epcList && e.epcList.some((epc) => epc.toLowerCase().includes(targetEpc))) {
          return true;
        }
        if (e.childEPCs && e.childEPCs.some((epc) => epc.toLowerCase().includes(targetEpc))) {
          return true;
        }
        if (e.parentID && e.parentID.toLowerCase().includes(targetEpc)) {
          return true;
        }
        return false;
      });
    }

    if (params.GE_eventTime) {
      const geTime = new Date(params.GE_eventTime).getTime();
      matched = matched.filter((e) => new Date(e.eventTime).getTime() >= geTime);
    }

    if (params.LE_eventTime) {
      const leTime = new Date(params.LE_eventTime).getTime();
      matched = matched.filter((e) => new Date(e.eventTime).getTime() <= leTime);
    }

    const direction = (params.orderDirection || 'DESC').toUpperCase();
    matched.sort((a, b) => {
      const tA = new Date(a.eventTime).getTime();
      const tB = new Date(b.eventTime).getTime();
      return direction === 'ASC' ? tA - tB : tB - tA;
    });

    const totalCount = matched.length;
    const perPage = params.perPage ? Math.min(Math.max(1, Number(params.perPage)), 100) : 30;

    let offset = 0;
    if (params.nextPageToken) {
      try {
        offset = parseInt(Buffer.from(params.nextPageToken, 'base64').toString('ascii'), 10);
        if (isNaN(offset)) offset = 0;
      } catch {
        offset = 0;
      }
    }

    const pagedEvents = matched.slice(offset, offset + perPage);
    let nextPageToken: string | undefined = undefined;
    if (offset + perPage < totalCount) {
      nextPageToken = Buffer.from((offset + perPage).toString()).toString('base64');
    }

    const queryDocument: EpcisQueryDocument = {
      '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
      type: 'EPCISQueryDocument',
      schemaVersion: '2.0',
      creationDate: new Date().toISOString(),
      epcisBody: {
        queryResults: {
          queryName: 'SimpleEventQuery',
          resultsBody: {
            eventList: pagedEvents,
          },
        },
      },
    };

    return {
      document: queryDocument,
      totalCount,
      nextPageToken,
    };
  }

  getEventById(eventID: string): EpcisJsonLdEvent & { eventID: string } {
    const event = this.eventStore.get(eventID);
    if (!event) {
      throw new NotFoundException(`EPCIS event not found for eventID ${eventID}`);
    }
    return event;
  }

  updateEventDisposition(eventID: string, disposition: string): EpcisJsonLdEvent & { eventID: string } {
    const event = this.getEventById(eventID);
    event.disposition = disposition;
    this.eventStore.set(eventID, event);
    return event;
  }

  deleteEvent(eventID: string): boolean {
    return this.eventStore.delete(eventID);
  }

  getEpcisVersion(): {
    version: string;
    standardsVersion: string;
    schemaVersion: string;
    vendor: string;
    cbvVersion: string;
  } {
    return {
      version: '2.0',
      standardsVersion: '2.0.0',
      schemaVersion: '2.0',
      cbvVersion: '2.0',
      vendor: 'PharmaTrace-ES / GS1 EPCIS 2.0 Compliant Gateway',
    };
  }

  getOpenApiSpec(): Record<string, any> {
    return {
      openapi: '3.0.3',
      info: {
        title: 'PharmaTrace-ES GS1 EPCIS 2.0 REST Query Interface',
        version: '2.0.0',
        description:
          'GS1 EPCIS 2.0 REST query protocol supporting standard CBV filtering (EQ_bizStep, MATCH_epc, GE_eventTime) for seamless ERP gateway interop (SAP ATTP, TraceLink).',
      },
      paths: {
        '/epcis/events': {
          get: {
            summary: 'Query EPCIS 2.0 Events',
            parameters: [
              { name: 'EQ_bizStep', in: 'query', schema: { type: 'string' } },
              { name: 'MATCH_epc', in: 'query', schema: { type: 'string' } },
              { name: 'GE_eventTime', in: 'query', schema: { type: 'string', format: 'date-time' } },
              { name: 'LE_eventTime', in: 'query', schema: { type: 'string', format: 'date-time' } },
              { name: 'EQ_action', in: 'query', schema: { type: 'string', enum: ['OBSERVE', 'ADD', 'DELETE'] } },
              { name: 'EQ_disposition', in: 'query', schema: { type: 'string' } },
              { name: 'EQ_readPoint', in: 'query', schema: { type: 'string' } },
              { name: 'EQ_bizLocation', in: 'query', schema: { type: 'string' } },
              { name: 'perPage', in: 'query', schema: { type: 'integer', default: 30 } },
              { name: 'nextPageToken', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
              '200': {
                description: 'EPCISQueryDocument containing query results',
                content: {
                  'application/ld+json': {
                    schema: { $ref: '#/components/schemas/EPCISQueryDocument' },
                  },
                },
              },
            },
          },
        },
        '/epcis/capture': {
          post: {
            summary: 'Capture EPCIS 2.0 Events',
            responses: {
              '201': {
                description: 'Capture job accepted',
              },
            },
          },
        },
        '/epcis/epcis-version': {
          get: {
            summary: 'Get EPCIS version',
            responses: {
              '200': {
                description: 'EPCIS protocol version metadata',
              },
            },
          },
        },
      },
      components: {
        schemas: {
          EPCISQueryDocument: {
            type: 'object',
            properties: {
              '@context': { type: 'array', items: { type: 'string' } },
              type: { type: 'string', example: 'EPCISQueryDocument' },
              schemaVersion: { type: 'string', example: '2.0' },
              epcisBody: { type: 'object' },
            },
          },
        },
      },
    };
  }
}
