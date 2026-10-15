import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DigitalTwinService } from '../digital-twin/digital-twin.service';

export interface Gs1ParsedElements {
  gtin: string;
  serialNumber: string;
  batchNumber?: string;
  expirationDate?: string;
  rawUri: string;
}

export interface Gs1LinkTarget {
  href: string;
  title: string;
  type: string;
  hreflang?: string[];
}

export interface Gs1LinksetResponse {
  anchor: string;
  'gs1:pip'?: Gs1LinkTarget[];
  'gs1:hasBatchLot'?: Gs1LinkTarget[];
  'gs1:epcis'?: Gs1LinkTarget[];
  'gs1:dvd'?: Gs1LinkTarget[];
  'gs1:certificationInfo'?: Gs1LinkTarget[];
  blockchainVerification: {
    exists: boolean;
    isAuthentic: boolean;
    isBurned: boolean;
    status: string;
    holder: string;
    tokenId?: string;
    ipfsDossierCid?: string;
  };
}

@Injectable()
export class DigitalLinkService {
  private readonly logger = new Logger(DigitalLinkService.name);

  constructor(private readonly digitalTwinService: DigitalTwinService) {}

  parseGs1Uri(inputUri: string): Gs1ParsedElements {
    const cleanUri = inputUri.trim();
    const urlPattern = /(?:\/01\/(\d{14}))(?:\/21\/([A-Za-z0-9\-._]+))/;
    const match = cleanUri.match(urlPattern);

    if (!match) {
      throw new BadRequestException('Invalid GS1 Digital Link syntax: must contain /01/{gtin14}/21/{serial}');
    }

    const gtin = match[1];
    const serialNumber = match[2];

    if (!this.validateGtinChecksum(gtin)) {
      throw new BadRequestException(`GTIN ${gtin} failed GS1 modulo-10 checksum validation`);
    }

    let batchNumber: string | undefined;
    let expirationDate: string | undefined;

    const queryStringIndex = cleanUri.indexOf('?');
    if (queryStringIndex !== -1) {
      const queryParams = new URLSearchParams(cleanUri.substring(queryStringIndex + 1));
      batchNumber = queryParams.get('10') || undefined;
      expirationDate = queryParams.get('17') || undefined;
    }

    return {
      gtin,
      serialNumber,
      batchNumber,
      expirationDate,
      rawUri: cleanUri,
    };
  }

  validateGtinChecksum(gtin: string): boolean {
    if (!/^\d{14}$/.test(gtin)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 13; i++) {
      const digit = parseInt(gtin.charAt(i), 10);
      sum += (i % 2 === 0) ? digit * 3 : digit * 1;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(gtin.charAt(13), 10);
  }

  formatGtin(rawGtin: string): string {
    const digits = rawGtin.replace(/\D/g, '');
    if (digits.length > 14) {
      throw new BadRequestException('GTIN length cannot exceed 14 digits');
    }
    return digits.padStart(14, '0');
  }

  buildCanonicalUri(gtin: string, serialNumber: string, batch?: string, expiry?: string): string {
    const formattedGtin = this.formatGtin(gtin);
    let uri = `https://id.gs1.org/01/${formattedGtin}/21/${serialNumber}`;
    const params = new URLSearchParams();
    if (batch) params.set('10', batch);
    if (expiry) params.set('17', expiry);
    const qs = params.toString();
    if (qs.length > 0) {
      uri += `?${qs}`;
    }
    return uri;
  }

  async resolveDigitalLink(gtin: string, serialNumber: string): Promise<Gs1LinksetResponse> {
    const formattedGtin = this.formatGtin(gtin);
    const anchor = `https://id.gs1.org/01/${formattedGtin}/21/${serialNumber}`;

    const verification = await this.digitalTwinService.verifyAuthenticity(serialNumber);

    const linkset: Gs1LinksetResponse = {
      anchor,
      'gs1:pip': [
        {
          href: `https://med-info.pharmatrace.io/products/${formattedGtin}/leaflet`,
          title: 'Patient Electronic Information Leaflet (e-PIL)',
          type: 'text/html',
          hreflang: ['en', 'es', 'fr', 'de'],
        },
      ],
      'gs1:hasBatchLot': [
        {
          href: `https://coa.pharmatrace.io/batches/${verification.details?.batchNumber || 'UNKNOWN'}/analytical-cert`,
          title: 'Batch Certificate of Analysis and Quality Assurance Release',
          type: 'application/pdf',
        },
      ],
      'gs1:epcis': [
        {
          href: `https://api.pharmatrace.io/epcis/events?gtin=${formattedGtin}&serial=${serialNumber}`,
          title: 'EPCIS 2.0 Custody and Aggregation Event Log',
          type: 'application/ld+json',
        },
      ],
      'gs1:dvd': [
        {
          href: `https://verify.pharmatrace.io/twin/${verification.details?.tokenId || 'unregistered'}`,
          title: 'On-Chain Digital Twin Authenticity and Anti-Recirculation Check',
          type: 'application/json',
        },
      ],
      'gs1:certificationInfo': [
        {
          href: `https://did.pharmatrace.io/credentials/fda-dscsa/${formattedGtin}`,
          title: 'FDA DSCSA Authorized Trading Partner Verification Dossier',
          type: 'application/json',
        },
      ],
      blockchainVerification: {
        exists: verification.exists,
        isAuthentic: verification.isAuthentic,
        isBurned: verification.isBurned,
        status: verification.status,
        holder: verification.holder,
        tokenId: verification.details?.tokenId,
        ipfsDossierCid: verification.details?.ipfsDossierCid,
      },
    };

    return linkset;
  }
}
