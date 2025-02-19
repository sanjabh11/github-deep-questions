import { Response } from 'express';
import { createLogger } from 'winston';

interface SSEMessage {
  type: 'thinking' | 'progress' | 'complete' | 'error';
  data?: any;
  error?: string;
}

export class SSEManager {
  private logger = createLogger({
    level: 'info',
    format: createLogger.format.json(),
    defaultMeta: { service: 'sse-manager' },
    transports: [
      new createLogger.transports.File({ filename: 'logs/sse-error.log', level: 'error' }),
      new createLogger.transports.File({ filename: 'logs/sse.log' })
    ]
  });

  constructor(private res: Response, private clientId: string) {
    this.setupSSE();
  }

  private setupSSE() {
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGIN || 'http://localhost:8080')
      : 'http://localhost:8080');
    this.res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Send initial connection established message
    this.send({
      type: 'thinking',
      data: 'Connection established'
    });

    // Keep connection alive with periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      if (this.res.writableEnded) {
        clearInterval(heartbeatInterval);
        return;
      }
      this.res.write(': heartbeat\n\n');
    }, 30000);

    // Cleanup on connection close
    this.res.on('close', () => {
      clearInterval(heartbeatInterval);
      this.logger.info(`SSE connection closed for client: ${this.clientId}`);
    });
  }

  send(message: SSEMessage) {
    if (this.res.writableEnded) {
      this.logger.warn(`Attempted to send message to closed connection: ${this.clientId}`);
      return;
    }

    try {
      this.res.write(`data: ${JSON.stringify(message)}\n\n`);
      this.logger.info(`Message sent to client: ${this.clientId}`, { type: message.type });
    } catch (error) {
      this.logger.error(`Error sending message to client: ${this.clientId}`, { error });
    }
  }

  error(error: Error | string) {
    this.send({
      type: 'error',
      error: error instanceof Error ? error.message : error
    });
    this.end();
  }

  progress(message: string) {
    this.send({
      type: 'progress',
      data: message
    });
  }

  complete(data: any) {
    this.send({
      type: 'complete',
      data
    });
    this.end();
  }

  end() {
    if (!this.res.writableEnded) {
      this.res.end();
    }
  }
}
