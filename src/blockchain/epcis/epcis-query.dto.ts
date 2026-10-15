export class EpcisQueryParametersDto {
  EQ_bizStep?: string;
  EQ_action?: 'OBSERVE' | 'ADD' | 'DELETE' | string;
  EQ_disposition?: string;
  EQ_readPoint?: string;
  EQ_bizLocation?: string;
  EQ_eventID?: string;
  MATCH_epc?: string;
  MATCH_parentID?: string;
  GE_eventTime?: string;
  LE_eventTime?: string;
  GE_recordTime?: string;
  LE_recordTime?: string;
  perPage?: number | string;
  nextPageToken?: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC' | string;
}

export interface EpcisQueryResultsBody {
  queryName: string;
  resultsBody: {
    eventList: any[];
  };
}

export interface EpcisQueryDocument {
  '@context': string[];
  type: 'EPCISQueryDocument';
  schemaVersion: '2.0';
  creationDate: string;
  epcisBody: {
    queryResults: EpcisQueryResultsBody;
  };
}

export interface EpcisCaptureJobResult {
  captureID: string;
  createdAt: string;
  eventCount: number;
  running: boolean;
  success: boolean;
  captureErrorCount: number;
}
