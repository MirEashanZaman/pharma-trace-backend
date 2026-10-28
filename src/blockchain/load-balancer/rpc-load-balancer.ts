import { Injectable, Logger } from '@nestjs/common';

export interface IRpcNode {
    id: string;
    url: string;
    name: string;
    weight: number;
    isHealthy: boolean;
    activeRequests: number;
    consecutiveFailures: number;
    totalRequests: number;
    lastLatencyMs: number;
}

export type LoadBalanceStrategy = 'ROUND_ROBIN' | 'LEAST_CONNECTIONS' | 'PRIORITY_FAILOVER';

@Injectable()
export class RpcLoadBalancer {
    private readonly logger = new Logger(RpcLoadBalancer.name);
    private nodes: IRpcNode[] = [];
    private readonly nodeMap: Map<string, IRpcNode> = new Map();
    private readonly urlMap: Map<string, IRpcNode> = new Map();
    private currentIndex: number = 0;
    private readonly maxFailureThreshold: number = 3;

    constructor() {
        this.initializeDefaultNodes();
    }

    private initializeDefaultNodes() {
        this.nodes = [
            {
                id: 'rpc-primary-local',
                url: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
                name: 'Primary EVM Local Hardhat Node',
                weight: 100,
                isHealthy: true,
                activeRequests: 0,
                consecutiveFailures: 0,
                totalRequests: 0,
                lastLatencyMs: 2,
            },
            {
                id: 'rpc-secondary-sepolia',
                url: 'https://rpc.sepolia.org',
                name: 'Secondary Public Sepolia Testnet Gateway',
                weight: 80,
                isHealthy: true,
                activeRequests: 0,
                consecutiveFailures: 0,
                totalRequests: 0,
                lastLatencyMs: 45,
            },
            {
                id: 'rpc-fallback-cloudflare',
                url: 'https://cloudflare-eth.com',
                name: 'Tertiary Disaster Recovery Fallback Node',
                weight: 50,
                isHealthy: true,
                activeRequests: 0,
                consecutiveFailures: 0,
                totalRequests: 0,
                lastLatencyMs: 65,
            },
        ];
        this.nodeMap.clear();
        this.urlMap.clear();
        for (const node of this.nodes) {
            this.nodeMap.set(node.id, node);
            this.urlMap.set(node.url, node);
        }
    }

    registerNode(node: Omit<IRpcNode, 'activeRequests' | 'consecutiveFailures' | 'totalRequests' | 'lastLatencyMs'>): void {
        const existing = this.nodeMap.get(node.id) || this.urlMap.get(node.url);
        if (existing) {
            existing.weight = node.weight;
            existing.name = node.name;
            existing.isHealthy = node.isHealthy;
            return;
        }

        const newNode: IRpcNode = {
            ...node,
            activeRequests: 0,
            consecutiveFailures: 0,
            totalRequests: 0,
            lastLatencyMs: 0,
        };
        this.nodes.push(newNode);
        this.nodeMap.set(newNode.id, newNode);
        this.urlMap.set(newNode.url, newNode);
    }

    selectNode(strategy: LoadBalanceStrategy = 'ROUND_ROBIN', candidates?: IRpcNode[]): IRpcNode {
        const pool = candidates || this.nodes;
        const healthyNodes = pool.filter((n) => n.isHealthy);
        if (healthyNodes.length === 0) {
            if (this.nodes.length > 0) {
                this.logger.warn('All RPC nodes marked unhealthy. Emergency recovery probe triggered on primary.');
                this.nodes[0].isHealthy = true;
                this.nodes[0].consecutiveFailures = 0;
                return this.nodes[0];
            }
            throw new Error('RpcLoadBalancer: No RPC nodes configured');
        }

        switch (strategy) {
            case 'LEAST_CONNECTIONS': {
                const sorted = [...healthyNodes].sort((a, b) => a.activeRequests - b.activeRequests);
                return sorted[0];
            }

            case 'PRIORITY_FAILOVER': {
                const sorted = [...healthyNodes].sort((a, b) => b.weight - a.weight);
                return sorted[0];
            }

            case 'ROUND_ROBIN':
            default: {
                this.currentIndex = (this.currentIndex + 1) % healthyNodes.length;
                return healthyNodes[this.currentIndex];
            }
        }
    }

    async executeWithFailover<T>(
        operation: (node: IRpcNode) => Promise<T>,
        strategy: LoadBalanceStrategy = 'ROUND_ROBIN',
        maxRetries: number = 3,
    ): Promise<{ result: T; servedBy: IRpcNode }> {
        let lastError: Error | null = null;
        const triedNodeIds = new Set<string>();
        const attempts = Math.min(maxRetries, this.nodes.length);

        for (let i = 0; i < attempts; i++) {
            const remaining = this.nodes.filter((n) => !triedNodeIds.has(n.id) && n.isHealthy);
            if (remaining.length === 0) break;

            const node = this.selectNode(strategy, remaining);
            triedNodeIds.add(node.id);
            node.activeRequests++;
            node.totalRequests++;
            const start = Date.now();

            try {
                const result = await operation(node);
                const latency = Date.now() - start;
                this.recordSuccess(node.id, latency);
                return { result, servedBy: node };
            } catch (err: any) {
                this.recordFailure(node.id);
                lastError = err;
                this.logger.warn(`Node ${node.id} (${node.name}) failed operation: ${err.message}. Failing over.`);
            } finally {
                node.activeRequests = Math.max(0, node.activeRequests - 1);
            }
        }

        throw new Error(`RpcLoadBalancer: All healthy node failover attempts exhausted. Last error: ${lastError?.message}`);
    }

    recordSuccess(nodeId: string, latencyMs: number): void {
        const node = this.nodeMap.get(nodeId);
        if (node) {
            node.consecutiveFailures = 0;
            node.isHealthy = true;
            node.lastLatencyMs = latencyMs;
        }
    }

    recordFailure(nodeId: string): void {
        const node = this.nodeMap.get(nodeId);
        if (node) {
            node.consecutiveFailures++;
            if (node.consecutiveFailures >= this.maxFailureThreshold) {
                node.isHealthy = false;
                this.logger.error(`Node ${node.id} (${node.name}) tripped to UNHEALTHY after ${node.consecutiveFailures} consecutive failures.`);
            }
        }
    }

    resetNodeHealth(nodeId: string): void {
        const node = this.nodeMap.get(nodeId);
        if (node) {
            node.isHealthy = true;
            node.consecutiveFailures = 0;
        }
    }

    getPoolStatus(): IRpcNode[] {
        return this.nodes.map((n) => ({ ...n }));
    }
}
