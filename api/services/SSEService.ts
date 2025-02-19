import { Response } from 'express';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'sse-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/sse-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/sse.log' })
  ]
});

export class SSEService {
  private connections: Map<string, Response> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  setupSSE(clientId: string, res: Response): void {
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable proxy buffering
    });

    // Store the connection
    this.connections.set(clientId, res);
    
    // Setup heartbeat
    const heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(clientId);
    }, 30000);
    
    this.heartbeatIntervals.set(clientId, heartbeatInterval);

    // Handle client disconnect
    res.on('close', () => {
      this.cleanup(clientId);
      logger.info(`Client disconnected: ${clientId}`);
    });

    logger.info(`SSE connection established for client: ${clientId}`);
  }

  private sendHeartbeat(clientId: string): void {
    const res = this.connections.get(clientId);
    if (res && !res.writableEnded) {
      res.write(':\n\n'); // SSE comment for heartbeat
    }
  }

  sendEvent(clientId: string, event: string, data: any): void {
    const res = this.connections.get(clientId);
    if (!res || res.writableEnded) {
      this.cleanup(clientId);
      return;
    }

    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      logger.debug(`Event sent to client ${clientId}:`, { event, data });
    } catch (error) {
      logger.error(`Error sending event to client ${clientId}:`, error);
      this.cleanup(clientId);
    }
  }

  private cleanup(clientId: string): void {
    // Clear heartbeat interval
    const interval = this.heartbeatIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(clientId);
    }

    // Close and remove connection
    const res = this.connections.get(clientId);
    if (res && !res.writableEnded) {
      res.end();
    }
    this.connections.delete(clientId);

    logger.info(`Cleaned up resources for client: ${clientId}`);
  }

  getActiveConnections(): number {
    return this.connections.size;
  }
}
