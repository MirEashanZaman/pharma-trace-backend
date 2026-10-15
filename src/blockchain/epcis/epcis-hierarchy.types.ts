export enum PackagingLevel {
    ITEM = 'ITEM',
    CASE = 'CASE',
    PALLET = 'PALLET',
    CONTAINER = 'CONTAINER',
}

export interface EpcisPackagingNode {
    id: string;
    level: PackagingLevel;
    parentId?: string;
    childIds: string[];
    gtin?: string;
    batchLot?: string;
    locationGln?: string;
    sealedTimestamp: number;
    isDeaggregated: boolean;
}

export interface EpcisAggregationEvent {
    eventId: string;
    parentSscc: string;
    parentLevel: PackagingLevel;
    childSgtins: string[];
    action: 'ADD' | 'DELETE' | 'OBSERVE';
    bizLocationGln: string;
    readPointGln: string;
    timestamp: number;
    aggregationHash: string;
}

export interface HierarchyTraceResult {
    serialNumber: string;
    level: PackagingLevel;
    ancestorSsccs: string[];
    rootContainerSscc?: string;
    isPackaged: boolean;
    locationGln?: string;
}
