declare module '@graphprotocol/graph-ts' {
  export class BigInt {
    static fromI32(value: number): BigInt;
    toHexString(): string;
    toString(): string;
  }
  export class Bytes {
    static fromHexString(value: string): Bytes;
    toHexString(): string;
  }
}
