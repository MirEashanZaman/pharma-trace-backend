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
        origin: '*',
        methods: ['GET', 'POST'],
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
    }) {
        if (this.server) {
            this.server.emit('telemetryUpdate', data);
        }
    }

    @SubscribeMessage('pingTelemetry')
    handlePing(client: Socket, payload: any) {
        return { event: 'pongTelemetry', data: { status: 'ONLINE', time: new Date().toISOString() } };
    }
}
