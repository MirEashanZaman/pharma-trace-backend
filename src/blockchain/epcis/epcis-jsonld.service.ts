import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface EpcisJsonLdEvent {
  type: 'ObjectEvent' | 'AggregationEvent' | 'TransactionEvent' | 'TransformationEvent';
  eventTime: string;
  eventTimeZoneOffset: string;
  action: 'OBSERVE' | 'ADD' | 'DELETE';
  bizStep: string;
  disposition: string;
  readPoint: { id: string };
  bizLocation: { id: string };
  epcList?: string[];
  parentID?: string;
  childEPCs?: string[];
  bizTransactionList?: Array<{ type: string; bizTransaction: string }>;
}

export interface EpcisDocument {
  '@context': string[];
  id: string;
  type: string;
  schemaVersion: string;
  creationDate: string;
  epcisBody: {
    eventList: EpcisJsonLdEvent[];
  };
}

export interface CanonicalizedEpcisResult {
  document: EpcisDocument;
  canonicalJson: string;
  eventHash: string;
  eventCount: number;
}

@Injectable()
export class EpcisJsonLdService {
  private readonly logger = new Logger(EpcisJsonLdService.name);

  buildCommissioningEvent(params: {
    gtin: string;
    serialNumbers: string[];
    locationGln: string;
    readPointGln: string;
    timestamp?: Date;
  }): EpcisJsonLdEvent {
    if (!params.gtin || params.serialNumbers.length === 0) {
      throw new BadRequestException('GTIN and at least one serial number required');
    }

    const date = params.timestamp ?? new Date();
    const epcList = params.serialNumbers.map(
      (sn) => `urn:epc:id:sgtin:${params.gtin}.${sn}`,
    );

    return {
      type: 'ObjectEvent',
      eventTime: date.toISOString(),
      eventTimeZoneOffset: '+00:00',
      action: 'ADD',
      bizStep: 'urn:epcglobal:cbv:bizstep:commissioning',
      disposition: 'urn:epcglobal:cbv:disp:active',
      readPoint: { id: `urn:epc:id:sgln:${params.readPointGln}.0` },
      bizLocation: { id: `urn:epc:id:sgln:${params.locationGln}.0` },
      epcList,
    };
  }

  buildAggregationEvent(params: {
    parentSscc: string;
    childEpcs: string[];
    locationGln: string;
    readPointGln: string;
    timestamp?: Date;
  }): EpcisJsonLdEvent {
    if (!params.parentSscc || params.childEpcs.length === 0) {
      throw new BadRequestException('Parent SSCC and child EPCs required');
    }

    const date = params.timestamp ?? new Date();
    return {
      type: 'AggregationEvent',
      eventTime: date.toISOString(),
      eventTimeZoneOffset: '+00:00',
      action: 'ADD',
      bizStep: 'urn:epcglobal:cbv:bizstep:packing',
      disposition: 'urn:epcglobal:cbv:disp:in_progress',
      readPoint: { id: `urn:epc:id:sgln:${params.readPointGln}.0` },
      bizLocation: { id: `urn:epc:id:sgln:${params.locationGln}.0` },
      parentID: `urn:epc:id:sscc:${params.parentSscc}`,
      childEPCs: params.childEpcs,
    };
  }

  buildShippingEvent(params: {
    epcs: string[];
    locationGln: string;
    readPointGln: string;
    orderReference?: string;
    timestamp?: Date;
  }): EpcisJsonLdEvent {
    const date = params.timestamp ?? new Date();
    const event: EpcisJsonLdEvent = {
      type: 'ObjectEvent',
      eventTime: date.toISOString(),
      eventTimeZoneOffset: '+00:00',
      action: 'OBSERVE',
      bizStep: 'urn:epcglobal:cbv:bizstep:shipping',
      disposition: 'urn:epcglobal:cbv:disp:in_transit',
      readPoint: { id: `urn:epc:id:sgln:${params.readPointGln}.0` },
      bizLocation: { id: `urn:epc:id:sgln:${params.locationGln}.0` },
      epcList: params.epcs,
    };

    if (params.orderReference) {
      event.bizTransactionList = [
        {
          type: 'urn:epcglobal:cbv:btt:po',
          bizTransaction: params.orderReference,
        },
      ];
    }

    return event;
  }

  buildDispenseEvent(params: {
    gtin: string;
    serialNumber: string;
    pharmacyGln: string;
    timestamp?: Date;
  }): EpcisJsonLdEvent {
    const date = params.timestamp ?? new Date();
    const epc = `urn:epc:id:sgtin:${params.gtin}.${params.serialNumber}`;

    return {
      type: 'ObjectEvent',
      eventTime: date.toISOString(),
      eventTimeZoneOffset: '+00:00',
      action: 'DELETE',
      bizStep: 'urn:epcglobal:cbv:bizstep:dispensing',
      disposition: 'urn:epcglobal:cbv:disp:dispensed',
      readPoint: { id: `urn:epc:id:sgln:${params.pharmacyGln}.0` },
      bizLocation: { id: `urn:epc:id:sgln:${params.pharmacyGln}.0` },
      epcList: [epc],
    };
  }

  wrapDocument(events: EpcisJsonLdEvent[], docId?: string): EpcisDocument {
    const id = docId ?? `urn:uuid:${createHash('sha256').update(Date.now().toString()).digest('hex').substring(0, 32)}`;
    return {
      '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
      id,
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      creationDate: new Date().toISOString(),
      epcisBody: {
        eventList: events,
      },
    };
  }

  canonicalizeAndHash(doc: EpcisDocument): CanonicalizedEpcisResult {
    const canonicalJson = this.deterministicStringify(doc);
    const hash = '0x' + createHash('sha256').update(canonicalJson, 'utf8').digest('hex');

    this.logger.log(`Generated canonical EPCIS 2.0 JSON-LD hash ${hash} for document ${doc.id}`);

    return {
      document: doc,
      canonicalJson,
      eventHash: hash,
      eventCount: doc.epcisBody.eventList.length,
    };
  }

  private deterministicStringify(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.deterministicStringify(item)).join(',') + ']';
    }

    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(
      (k) => JSON.stringify(k) + ':' + this.deterministicStringify(obj[k]),
    );

    return '{' + pairs.join(',') + '}';
  }
}
