import { createLogger } from 'winston';

interface Connection {
  id: string;
  timestamp: number;
  lastHeartbeat: number;
  ip: string;
  path: string;
  cleanup: () => void;
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 120000; // 2 minutes
  private logger = createLogger({
    level: 'info',
    format: createLogger.format.json(),
    defaultMeta: { service: 'connection-manager' },
    transports: [
      new createLogger.transports.File({ filename: 'logs/connection-error.log', level: 'error' }),
      new createLogger.transports.File({ filename: 'logs/connections.log' })
    ]
  });

  constructor() {
    // Start connection cleanup interval
    setInterval(() => this.cleanupStaleConnections(), this.HEARTBEAT_INTERVAL);
  }

  addConnection(id: string, ip: string, path: string, cleanup: () => void): void {
    const now = Date.now();
    this.connections.set(id, {
      id,
      timestamp: now,
      lastHeartbeat: now,
      ip,
      path,
      cleanup
    });
    this.logger.info(`Connection added: ${id}`, { ip, path });
  }

  updateHeartbeat(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.lastHeartbeat = Date.now();
      this.connections.set(id, connection);
    }
  }

  removeConnection(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.cleanup();
      this.connections.delete(id);
      this.logger.info(`Connection removed: ${id}`);
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    for (const [id, connection] of this.connections.entries()) {
      if (now - connection.lastHeartbeat > this.CONNECTION_TIMEOUT) {
        this.logger.warn(`Cleaning up stale connection: ${id}`);
        this.removeConnection(id);
      }
    }
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  getConnectionStats(): { active: number; stale: number } {
    const now = Date.now();
    let stale = 0;
    
    for (const connection of this.connections.values()) {
      if (now - connection.lastHeartbeat > this.CONNECTION_TIMEOUT) {
        stale++;
      }
    }

    return {
      active: this.connections.size - stale,
      stale
    };
  }
}
