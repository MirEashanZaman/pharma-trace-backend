import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: process.env.CORS_ALLOWED_ORIGINS
            ? process.env.CORS_ALLOWED_ORIGINS.split(',')
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
    },
})
@Injectable()
export class IotGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(IotGateway.name);

    afterInit(server: Server) {
        this.logger.log('IoT Telemetry WebSocket Gateway Initialized');
    }

    handleConnection(client: Socket) {
        const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
        if (!token && process.env.NODE_ENV === 'production') {
            this.logger.warn(`Rejecting unauthenticated socket connection: ${client.id}`);
            client.disconnect();
            return;
        }
        this.logger.log(`Client Connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client Disconnected: ${client.id}`);
    }

    broadcastTelemetry(data: {
        serialNumber: string;
        temperature: number;
        humidity: number;
        timestamp: string;
        isExcursion?: boolean;
        location?: string;
    }) {
        if (this.server) {
            this.server.emit('telemetryUpdate', data);
        }
    }

    @SubscribeMessage('simulateTelemetry')
    handleSimulateTelemetry(
        client: Socket,
        payload: {
            serialNumber?: string;
            temperature: number;
            humidity: number;
            isExcursion?: boolean;
            location?: string;
        },
    ) {
        const isExcursion =
            payload.isExcursion !== undefined
                ? payload.isExcursion
                : payload.temperature < 2 || payload.temperature > 8;

        const broadcastData = {
            serialNumber: payload.serialNumber || 'RX-994821',
            temperature: Number(payload.temperature),
            humidity: Number(payload.humidity),
            timestamp: new Date().toISOString(),
            isExcursion,
            location: payload.location || 'Cold-Chain Mobile Reefer Unit',
        };

        this.broadcastTelemetry(broadcastData);
        return { event: 'simulationAcknowledged', data: broadcastData };
    }

    @SubscribeMessage('pingTelemetry')
    handlePing(client: Socket, payload: any) {
        return { event: 'pongTelemetry', data: { status: 'ONLINE', time: new Date().toISOString() } };
    }
}
