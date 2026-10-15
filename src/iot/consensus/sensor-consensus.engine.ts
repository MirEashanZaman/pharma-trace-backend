import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface SensorReading {
  sensorId: string;
  temperature: number;
  humidity?: number;
  timestamp?: number;
  batteryLevel?: number;
  isHardwareAuthenticated?: boolean;
}

export interface CheckpointCluster {
  checkpointId: string;
  timestamp: number;
  readings: SensorReading[];
}

export interface FaultySensorReport {
  sensorId: string;
  reading: number;
  deviation: number;
  reason: 'HIGH_OUTLIER' | 'LOW_OUTLIER';
}

export interface ConsensusEvaluation {
  checkpointId: string;
  timestamp: number;
  medianTemperature: number;
  meanTemperature: number;
  sampleCount: number;
  healthySensorCount: number;
  faultySensors: FaultySensorReport[];
  isCompliant: boolean;
  minAllowed: number;
  maxAllowed: number;
  confidenceScore: number;
}

export interface EscrowConsensusReport {
  orderId: string;
  totalCheckpoints: number;
  compliantCheckpoints: number;
  excursionCheckpoints: number;
  isolatedSensorFaults: number;
  overallMedianTemperature: number;
  minRecordedMedian: number;
  maxRecordedMedian: number;
  isSettlementApproved: boolean;
  settlementReason: string;
  evaluations: ConsensusEvaluation[];
}

@Injectable()
export class SensorConsensusEngine {
  private readonly logger = new Logger(SensorConsensusEngine.name);

  calculateMedian(values: number[]): number {
    if (values.length === 0) {
      throw new BadRequestException('Cannot calculate median of an empty set of readings');
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return Number(sorted[mid].toFixed(2));
    }
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  }

  evaluateCheckpoint(
    checkpoint: CheckpointCluster,
    minTemp: number = 2.0,
    maxTemp: number = 8.0,
    outlierTolerance: number = 2.5,
  ): ConsensusEvaluation {
    if (!checkpoint.readings || checkpoint.readings.length < 2) {
      throw new BadRequestException(
        `Checkpoint ${checkpoint.checkpointId} requires at least 2 independent sensor readings for Byzantine quorum`,
      );
    }

    const temperatures = checkpoint.readings.map((r) => r.temperature);
    const medianTemp = this.calculateMedian(temperatures);
    const sum = temperatures.reduce((acc, curr) => acc + curr, 0);
    const meanTemp = Number((sum / temperatures.length).toFixed(2));

    const faultySensors: FaultySensorReport[] = [];
    let healthyCount = 0;

    for (const reading of checkpoint.readings) {
      const deviation = Math.abs(reading.temperature - medianTemp);
      if (deviation > outlierTolerance) {
        faultySensors.push({
          sensorId: reading.sensorId,
          reading: reading.temperature,
          deviation: Number(deviation.toFixed(2)),
          reason: reading.temperature > medianTemp ? 'HIGH_OUTLIER' : 'LOW_OUTLIER',
        });
      } else {
        healthyCount++;
      }
    }

    const isCompliant = medianTemp >= minTemp && medianTemp <= maxTemp;
    const confidenceScore = Number(((healthyCount / checkpoint.readings.length) * 100).toFixed(1));

    if (faultySensors.length > 0) {
      this.logger.warn(
        `Isolated ${faultySensors.length} faulty sensor(s) at checkpoint ${checkpoint.checkpointId}. Cluster median: ${medianTemp}C`,
      );
    }

    return {
      checkpointId: checkpoint.checkpointId,
      timestamp: checkpoint.timestamp,
      medianTemperature: medianTemp,
      meanTemperature: meanTemp,
      sampleCount: checkpoint.readings.length,
      healthySensorCount: healthyCount,
      faultySensors,
      isCompliant,
      minAllowed: minTemp,
      maxAllowed: maxTemp,
      confidenceScore,
    };
  }

  evaluateTransitSeries(
    orderId: string,
    clusters: CheckpointCluster[],
    minTemp: number = 2.0,
    maxTemp: number = 8.0,
    outlierTolerance: number = 2.5,
  ): EscrowConsensusReport {
    if (!clusters || clusters.length === 0) {
      throw new BadRequestException('Transit evaluation requires at least one multi-sensor checkpoint cluster');
    }

    const evaluations: ConsensusEvaluation[] = [];
    let compliantCount = 0;
    let excursionCount = 0;
    let totalIsolatedFaults = 0;
    const allMedians: number[] = [];

    for (const cluster of clusters) {
      const evalResult = this.evaluateCheckpoint(cluster, minTemp, maxTemp, outlierTolerance);
      evaluations.push(evalResult);
      allMedians.push(evalResult.medianTemperature);
      totalIsolatedFaults += evalResult.faultySensors.length;

      if (evalResult.isCompliant) {
        compliantCount++;
      } else {
        excursionCount++;
      }
    }

    const overallMedian = this.calculateMedian(allMedians);
    const minMedian = Math.min(...allMedians);
    const maxMedian = Math.max(...allMedians);
    const isSettlementApproved = excursionCount === 0;

    const settlementReason = isSettlementApproved
      ? `Consensus median temperature verified compliant across all ${clusters.length} checkpoints (${minMedian}C - ${maxMedian}C). Isolated ${totalIsolatedFaults} hardware sensor fault(s) without delivery breach.`
      : `Cold-chain breach detected: ${excursionCount} checkpoint cluster(s) breached allowed [${minTemp}, ${maxTemp}] deg C range. Minimum recorded median: ${minMedian}C, Maximum recorded median: ${maxMedian}C.`;

    this.logger.log(
      `Evaluated multi-sensor consensus for escrow ${orderId}: Approved=${isSettlementApproved}, Isolated Faults=${totalIsolatedFaults}`,
    );

    return {
      orderId,
      totalCheckpoints: clusters.length,
      compliantCheckpoints: compliantCount,
      excursionCheckpoints: excursionCount,
      isolatedSensorFaults: totalIsolatedFaults,
      overallMedianTemperature: overallMedian,
      minRecordedMedian: minMedian,
      maxRecordedMedian: maxMedian,
      isSettlementApproved,
      settlementReason,
      evaluations,
    };
  }
}
