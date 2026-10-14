export interface NormalizedTelemetry {
    serialNumber: string;
    temperature: number;
    humidity: number;
    location: string;
    sourceProtocol: 'ESP32_RAW' | 'MODBUS_PLC' | 'REST_JSON';
    timestamp: string;
}

export interface IIotSensorAdapter {
    adaptRawDeviceString(payload: string): NormalizedTelemetry;
    adaptModbusRegisters(serialNumber: string, registers: number[]): NormalizedTelemetry;
    adaptJsonPayload(payload: any): NormalizedTelemetry;
}

export class IotSensorAdapter implements IIotSensorAdapter {
    adaptRawDeviceString(payload: string): NormalizedTelemetry {
        const parts = payload.split(';');
        const dict: Record<string, string> = {};

        parts.forEach((part) => {
            const [k, v] = part.split(':');
            if (k && v) {
                dict[k.trim().toUpperCase()] = v.trim();
            }
        });

        const tempVal = parseFloat(dict['TEMP'] || dict['T'] || '4.0');
        const humVal = parseFloat(dict['HUM'] || dict['H'] || '50.0');

        return {
            serialNumber: dict['SERIAL'] || dict['SN'] || 'UNKNOWN_BATCH',
            temperature: isNaN(tempVal) ? 4.0 : Number(tempVal.toFixed(1)),
            humidity: isNaN(humVal) ? 50.0 : Number(humVal.toFixed(1)),
            location: dict['LOC'] || dict['DEVICE'] || 'Automated Transit Reefer',
            sourceProtocol: 'ESP32_RAW',
            timestamp: new Date().toISOString(),
        };
    }

    adaptModbusRegisters(serialNumber: string, registers: number[]): NormalizedTelemetry {
        const rawTemp = registers[0] !== undefined ? registers[0] / 10.0 : 4.0;
        const rawHum = registers[1] !== undefined ? registers[1] / 10.0 : 50.0;
        const locCode = registers[2] !== undefined ? `Depot Sector #${registers[2]}` : 'Cold Storage Zone 1';

        return {
            serialNumber,
            temperature: Number(rawTemp.toFixed(1)),
            humidity: Number(rawHum.toFixed(1)),
            location: locCode,
            sourceProtocol: 'MODBUS_PLC',
            timestamp: new Date().toISOString(),
        };
    }

    adaptJsonPayload(payload: any): NormalizedTelemetry {
        const temp = typeof payload?.temperature === 'number'
            ? payload.temperature
            : parseFloat(payload?.temp || '4.0');

        const hum = typeof payload?.humidity === 'number'
            ? payload.humidity
            : parseFloat(payload?.hum || '50.0');

        return {
            serialNumber: payload?.serialNumber || 'UNKNOWN_BATCH',
            temperature: isNaN(temp) ? 4.0 : Number(temp.toFixed(1)),
            humidity: isNaN(hum) ? 50.0 : Number(hum.toFixed(1)),
            location: payload?.location || 'Authorized Mobile Reefer Unit',
            sourceProtocol: 'REST_JSON',
            timestamp: new Date().toISOString(),
        };
    }
}
