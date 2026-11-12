# PharmaTrace Subgraph

The Graph Protocol Subgraph indexing pharmaceutical supply chain provenance across the PharmaTrace smart contract ecosystem.

## Overview

The subgraph indexes events emitted across the core smart contracts:
- `PharmaDigitalTwin`: Tokenized item and batch twins, serial numbers, GTINs, and custody transfers.
- `PharmaEscrowEngine`: Commercial payment escrows, conditional cold-chain releases, and refunds.
- `PharmaTraceAttestation`: Cryptographic attestations, Merkle batch rollups, and soulbound accreditations.
- `CarrierStakingEscrow`: Carrier bonds, slashes, and performance stakes.
- `ZkColdChainVerifier`: Groth16 zero-knowledge proof verification records.
- `ColdChainAutomationOracle`: Automated IoT telemetry events, excursion alerts, and automated penalties.

## Directory Structure

- `schema.graphql`: GraphQL schema defining indexed entities.
- `subgraph.yaml`: Subgraph manifest configuring data sources, ABIs, and event handlers.
- `src/mapping.ts`: AssemblyScript event handler routines with input sanitization.
- `queries.graphql`: Pre-built GraphQL queries for provenance timelines and audits.

## Commands

```bash
cd subgraph
npm install
npm run codegen
npm run build
npm run create:local
npm run deploy:local
```
