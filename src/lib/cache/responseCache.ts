import { InterfaceType, QueryType } from '../../shared/prompts.js';
import { ApiResponse } from '../../shared/types';

interface CacheEntry {
  response: ApiResponse;
  timestamp: number;
  interfaceType: InterfaceType;
  queryType: QueryType;
  version: string;
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
  versionTracking: boolean;
}

class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private interfaceConfigs: Record<InterfaceType, CacheConfig>;
  
  constructor() {
    this.cache = new Map();
    
    // Configure cache settings for each interface
    this.interfaceConfigs = {
      GENERAL: {
        ttl: 30 * 60 * 1000, // 30 minutes
        maxSize: 100,
        versionTracking: false
      },
      RESEARCHER: {
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 500,
        versionTracking: true
      },
      CODER: {
        ttl: 12 * 60 * 60 * 1000, // 12 hours
        maxSize: 200,
        versionTracking: true
      }
    };
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Run every hour
  }

  private generateCacheKey(
    query: string,
    interfaceType: InterfaceType,
    queryType: QueryType,
    files?: Array<{ name: string; content: string }>
  ): string {
    const components = [
      query,
      interfaceType,
      queryType,
      files ? JSON.stringify(files.map(f => ({ name: f.name, hash: this.hashContent(f.content) }))) : ''
    ];
    
    return components.join('::');
  }

  private hashContent(content: string): string {
    // Simple hash function for demo
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const config = this.interfaceConfigs[entry.interfaceType];
      
      if (now - entry.timestamp > config.ttl) {
        this.cache.delete(key);
      }
    }
    
    // Enforce size limits per interface
    const entriesByInterface = new Map<InterfaceType, Array<[string, CacheEntry]>>();
    
    for (const [key, entry] of this.cache.entries()) {
      const entries = entriesByInterface.get(entry.interfaceType) || [];
      entries.push([key, entry]);
      entriesByInterface.set(entry.interfaceType, entries);
    }
    
    for (const [interfaceType, entries] of entriesByInterface.entries()) {
      const config = this.interfaceConfigs[interfaceType];
      
      if (entries.length > config.maxSize) {
        // Sort by timestamp and remove oldest entries
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        const toRemove = entries.slice(config.maxSize);
        for (const [key] of toRemove) {
          this.cache.delete(key);
        }
      }
    }
  }

  public get(
    query: string,
    interfaceType: InterfaceType,
    queryType: QueryType,
    files?: Array<{ name: string; content: string }>
  ): ApiResponse | null {
    const key = this.generateCacheKey(query, interfaceType, queryType, files);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const config = this.interfaceConfigs[interfaceType];
    const now = Date.now();
    
    // Check if entry is still valid
    if (now - entry.timestamp > config.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.response;
  }

  public set(
    query: string,
    interfaceType: InterfaceType,
    queryType: QueryType,
    response: ApiResponse,
    files?: Array<{ name: string; content: string }>
  ): void {
    const key = this.generateCacheKey(query, interfaceType, queryType, files);
    const config = this.interfaceConfigs[interfaceType];
    
    // Check size limit before adding
    const interfaceEntries = Array.from(this.cache.values())
      .filter(entry => entry.interfaceType === interfaceType);
    
    if (interfaceEntries.length >= config.maxSize) {
      // Remove oldest entry for this interface
      const oldest = interfaceEntries
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      
      for (const [k, v] of this.cache.entries()) {
        if (v === oldest) {
          this.cache.delete(k);
          break;
        }
      }
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      interfaceType,
      queryType,
      version: `1.0.${Date.now().toString(36)}`
    });
  }

  public getStats(): Record<InterfaceType, {
    entries: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    const stats: Record<string, { entries: number; oldestEntry: number; newestEntry: number }> = {};
    
    for (const interfaceType of Object.keys(this.interfaceConfigs)) {
      const entries = Array.from(this.cache.values())
        .filter(entry => entry.interfaceType === interfaceType);
      
      stats[interfaceType] = {
        entries: entries.length,
        oldestEntry: entries.length ? Math.min(...entries.map(e => e.timestamp)) : 0,
        newestEntry: entries.length ? Math.max(...entries.map(e => e.timestamp)) : 0
      };
    }
    
    return stats as Record<InterfaceType, typeof stats[keyof typeof stats]>;
  }
}

// Export singleton instance
export const responseCache = new ResponseCache(); 