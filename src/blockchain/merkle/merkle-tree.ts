import { keccak256, getBytes } from 'ethers';

export class MerkleTree {
    private readonly leaves: string[];
    private readonly layers: string[][];

    constructor(leaves: string[]) {
        if (!leaves || leaves.length === 0) {
            throw new Error('MerkleTree requires at least one leaf');
        }
        this.leaves = leaves.map((leaf) => this.normalizeHash(leaf));
        this.layers = this.buildLayers(this.leaves);
    }

    private normalizeHash(hash: string): string {
        if (hash.startsWith('0x') && hash.length === 66) {
            return hash.toLowerCase();
        }
        const cleaned = hash.replace(/^0x/, '');
        return ('0x' + cleaned.padEnd(64, '0').slice(0, 64)).toLowerCase();
    }

    private hashPair(a: string, b: string): string {
        const bufA = getBytes(a);
        const bufB = getBytes(b);
        for (let i = 0; i < 32; i++) {
            if (bufA[i] < bufB[i]) {
                return keccak256(new Uint8Array([...bufA, ...bufB])).toLowerCase();
            } else if (bufA[i] > bufB[i]) {
                return keccak256(new Uint8Array([...bufB, ...bufA])).toLowerCase();
            }
        }
        return keccak256(new Uint8Array([...bufA, ...bufB])).toLowerCase();
    }

    private buildLayers(leaves: string[]): string[][] {
        const layers: string[][] = [leaves];
        let currentLayer = leaves;

        while (currentLayer.length > 1) {
            const nextLayer: string[] = [];
            for (let i = 0; i < currentLayer.length; i += 2) {
                if (i + 1 < currentLayer.length) {
                    nextLayer.push(this.hashPair(currentLayer[i], currentLayer[i + 1]));
                } else {
                    nextLayer.push(currentLayer[i]);
                }
            }
            layers.push(nextLayer);
            currentLayer = nextLayer;
        }

        return layers;
    }

    getRoot(): string {
        return this.layers[this.layers.length - 1][0];
    }

    getProof(leaf: string): string[] {
        const normalized = this.normalizeHash(leaf);
        let index = this.leaves.indexOf(normalized);
        if (index === -1) {
            throw new Error(`Leaf ${leaf} not found in MerkleTree`);
        }

        const proof: string[] = [];
        for (let i = 0; i < this.layers.length - 1; i++) {
            const layer = this.layers[i];
            const isRightNode = index % 2 === 1;
            const pairIndex = isRightNode ? index - 1 : index + 1;

            if (pairIndex < layer.length) {
                proof.push(layer[pairIndex]);
            }
            index = Math.floor(index / 2);
        }

        return proof;
    }

    static verifyProof(leaf: string, proof: string[], root: string): boolean {
        let computed = leaf.startsWith('0x') && leaf.length === 66
            ? leaf.toLowerCase()
            : ('0x' + leaf.replace(/^0x/, '').padEnd(64, '0').slice(0, 64)).toLowerCase();
        const expectedRoot = root.toLowerCase();

        for (const sibling of proof) {
            const bufA = getBytes(computed);
            const bufB = getBytes(sibling.toLowerCase());
            let aSmaller = false;
            let equal = true;
            for (let i = 0; i < 32; i++) {
                if (bufA[i] < bufB[i]) {
                    aSmaller = true;
                    equal = false;
                    break;
                } else if (bufA[i] > bufB[i]) {
                    aSmaller = false;
                    equal = false;
                    break;
                }
            }
            if (equal || aSmaller) {
                computed = keccak256(new Uint8Array([...bufA, ...bufB])).toLowerCase();
            } else {
                computed = keccak256(new Uint8Array([...bufB, ...bufA])).toLowerCase();
            }
        }

        return computed === expectedRoot;
    }

    getLeaves(): string[] {
        return [...this.leaves];
    }

    getLeafCount(): number {
        return this.leaves.length;
    }
}
