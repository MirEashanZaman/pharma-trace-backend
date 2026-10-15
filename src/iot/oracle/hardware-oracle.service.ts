import { Injectable, Logger } from '@nestjs/common';
import { verifyMessage } from 'ethers';

export interface HardwareTelemetryPayload {
    deviceId: string;
    temperature: number;
    humidity: number;
    latitude?: number;
    longitude?: number;
    timestamp: number;
    nonce: number;
    signature: string;
}

export interface HardwareDeviceRegistration {
    deviceId: string;
    deviceAddress: string;
    hardwareModel: string;
    enclaveType: 'ATECC608A' | 'SE050' | 'NRF9160_TEE' | 'VIRTUAL_HSM';
    registeredAt: number;
    isActive: boolean;
    lastSeenNonce: number;
}

export interface TelemetryAttestationReport {
    isValid: boolean;
    reason?: string;
    deviceId: string;
    deviceAddress?: string;
    temperature: number;
    humidity: number;
    timestamp: number;
    verifiedAt: number;
}

@Injectable()
export class HardwareOracleService {
    private readonly logger = new Logger(HardwareOracleService.name);
    private readonly devices: Map<string, HardwareDeviceRegistration> = new Map();

    registerDevice(
        deviceId: string,
        deviceAddress: string,
        hardwareModel: string = 'ATECC608A-CryptoAuth',
        enclaveType: 'ATECC608A' | 'SE050' | 'NRF9160_TEE' | 'VIRTUAL_HSM' = 'ATECC608A',
    ): HardwareDeviceRegistration {
        const registration: HardwareDeviceRegistration = {
            deviceId,
            deviceAddress: deviceAddress.toLowerCase(),
            hardwareModel,
            enclaveType,
            registeredAt: Date.now(),
            isActive: true,
            lastSeenNonce: 0,
        };
        this.devices.set(deviceId, registration);
        this.logger.log(`Registered hardware enclave device ${deviceId} (${deviceAddress})`);
        return registration;
    }

    formatTelemetryMessage(payload: Omit<HardwareTelemetryPayload, 'signature'>): string {
        return `PHARMATRACE-IOT:${payload.deviceId}:${payload.temperature.toFixed(2)}:${payload.humidity.toFixed(2)}:${payload.timestamp}:${payload.nonce}`;
    }

    verifyTelemetry(payload: HardwareTelemetryPayload): TelemetryAttestationReport {
        const device = this.devices.get(payload.deviceId);
        if (!device) {
            return {
                isValid: false,
                reason: `Unregistered hardware device: ${payload.deviceId}`,
                deviceId: payload.deviceId,
                temperature: payload.temperature,
                humidity: payload.humidity,
                timestamp: payload.timestamp,
                verifiedAt: Date.now(),
            };
        }

        if (!device.isActive) {
            return {
                isValid: false,
                reason: `Device ${payload.deviceId} is deactivated or revoked`,
                deviceId: payload.deviceId,
                deviceAddress: device.deviceAddress,
                temperature: payload.temperature,
                humidity: payload.humidity,
                timestamp: payload.timestamp,
                verifiedAt: Date.now(),
            };
        }

        if (payload.nonce <= device.lastSeenNonce) {
            return {
                isValid: false,
                reason: `Anti-replay violation: nonce ${payload.nonce} <= last seen ${device.lastSeenNonce}`,
                deviceId: payload.deviceId,
                deviceAddress: device.deviceAddress,
                temperature: payload.temperature,
                humidity: payload.humidity,
                timestamp: payload.timestamp,
                verifiedAt: Date.now(),
            };
        }

        const message = this.formatTelemetryMessage({
            deviceId: payload.deviceId,
            temperature: payload.temperature,
            humidity: payload.humidity,
            latitude: payload.latitude,
            longitude: payload.longitude,
            timestamp: payload.timestamp,
            nonce: payload.nonce,
        });

        try {
            const recovered = verifyMessage(message, payload.signature);
            if (recovered.toLowerCase() !== device.deviceAddress.toLowerCase()) {
                return {
                    isValid: false,
                    reason: `Signature mismatch: recovered ${recovered} does not match enclave address ${device.deviceAddress}`,
                    deviceId: payload.deviceId,
                    deviceAddress: device.deviceAddress,
                    temperature: payload.temperature,
                    humidity: payload.humidity,
                    timestamp: payload.timestamp,
                    verifiedAt: Date.now(),
                };
            }

            device.lastSeenNonce = payload.nonce;
            return {
                isValid: true,
                deviceId: payload.deviceId,
                deviceAddress: device.deviceAddress,
                temperature: payload.temperature,
                humidity: payload.humidity,
                timestamp: payload.timestamp,
                verifiedAt: Date.now(),
            };
        } catch (err: any) {
            return {
                isValid: false,
                reason: `Cryptographic verification failed: ${err.message}`,
                deviceId: payload.deviceId,
                deviceAddress: device.deviceAddress,
                temperature: payload.temperature,
                humidity: payload.humidity,
                timestamp: payload.timestamp,
                verifiedAt: Date.now(),
            };
        }
    }

    getDevice(deviceId: string): HardwareDeviceRegistration | undefined {
        return this.devices.get(deviceId);
    }
}
