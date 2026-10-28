import { Injectable, Logger } from '@nestjs/common';
import { keccak256, toUtf8Bytes } from 'ethers';
import {
    EpcisAggregationEvent,
    EpcisPackagingNode,
    HierarchyTraceResult,
    PackagingLevel,
} from './epcis-hierarchy.types';

@Injectable()
export class EpcisAggregator {
    private readonly logger = new Logger(EpcisAggregator.name);
    private readonly nodes: Map<string, EpcisPackagingNode> = new Map();
    private readonly aggregationEvents: EpcisAggregationEvent[] = [];

    registerItem(
        sgtin: string,
        gtin: string,
        batchLot: string,
        locationGln: string = '0000000000000',
    ): EpcisPackagingNode {
        const node: EpcisPackagingNode = {
            id: sgtin,
            level: PackagingLevel.ITEM,
            childIds: [],
            gtin,
            batchLot,
            locationGln,
            sealedTimestamp: Date.now(),
            isDeaggregated: false,
        };
        this.nodes.set(sgtin, node);
        return node;
    }

    pack(
        parentSscc: string,
        parentLevel: PackagingLevel,
        childIds: string[],
        locationGln: string = '0000000000000',
    ): EpcisAggregationEvent {
        if (!childIds || childIds.length === 0) {
            throw new Error('Packaging aggregation requires at least one child node');
        }

        for (const childId of childIds) {
            const childNode = this.nodes.get(childId);
            if (!childNode) {
                this.registerItem(childId, 'GTIN-UNKNOWN', 'BATCH-UNKNOWN', locationGln);
            }
        }

        const parentNode: EpcisPackagingNode = {
            id: parentSscc,
            level: parentLevel,
            childIds: [...childIds],
            locationGln,
            sealedTimestamp: Date.now(),
            isDeaggregated: false,
        };
        this.nodes.set(parentSscc, parentNode);

        for (const childId of childIds) {
            const child = this.nodes.get(childId)!;
            child.parentId = parentSscc;
            child.locationGln = locationGln;
        }

        const sortedChildren = [...childIds].sort();
        const payload = `${parentSscc}:${parentLevel}:${sortedChildren.join(',')}:${Date.now()}`;
        const aggregationHash = keccak256(toUtf8Bytes(payload));

        const event: EpcisAggregationEvent = {
            eventId: `AGG-${Date.now()}-${parentSscc.slice(-6)}`,
            parentSscc,
            parentLevel,
            childSgtins: childIds,
            action: 'ADD',
            bizLocationGln: locationGln,
            readPointGln: locationGln,
            timestamp: Date.now(),
            aggregationHash,
        };

        this.aggregationEvents.push(event);
        this.logger.log(`Packed ${childIds.length} children into ${parentLevel} ${parentSscc}`);
        return event;
    }

    deaggregate(parentSscc: string): boolean {
        const parent = this.nodes.get(parentSscc);
        if (!parent || parent.isDeaggregated) {
            return false;
        }

        parent.isDeaggregated = true;
        for (const childId of parent.childIds) {
            const child = this.nodes.get(childId);
            if (child) {
                child.parentId = undefined;
            }
        }

        const event: EpcisAggregationEvent = {
            eventId: `DEAGG-${Date.now()}-${parentSscc.slice(-6)}`,
            parentSscc,
            parentLevel: parent.level,
            childSgtins: parent.childIds,
            action: 'DELETE',
            bizLocationGln: parent.locationGln || '0000000000000',
            readPointGln: parent.locationGln || '0000000000000',
            timestamp: Date.now(),
            aggregationHash: keccak256(toUtf8Bytes(`DEAGG:${parentSscc}:${Date.now()}`)),
        };
        this.aggregationEvents.push(event);
        return true;
    }

    traceHierarchy(id: string): HierarchyTraceResult {
        const node = this.nodes.get(id);
        if (!node) {
            return {
                serialNumber: id,
                level: PackagingLevel.ITEM,
                ancestorSsccs: [],
                isPackaged: false,
            };
        }

        const ancestors: string[] = [];
        const visited = new Set<string>();
        let curr: EpcisPackagingNode | undefined = node;
        while (curr?.parentId && !visited.has(curr.parentId)) {
            visited.add(curr.parentId);
            ancestors.push(curr.parentId);
            curr = this.nodes.get(curr.parentId);
        }

        return {
            serialNumber: id,
            level: node.level,
            ancestorSsccs: ancestors,
            rootContainerSscc: ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined,
            isPackaged: ancestors.length > 0 && !node.isDeaggregated,
            locationGln: curr?.locationGln || node.locationGln,
        };
    }

    getAllEvents(): EpcisAggregationEvent[] {
        return [...this.aggregationEvents];
    }
}
