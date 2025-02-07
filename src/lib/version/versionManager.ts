import { InterfaceType } from '../../../shared/prompts';
import { Message, ThoughtProcess } from '../../../shared/types';

interface VersionEntry {
  version: string;
  parentVersion?: string;
  timestamp: number;
  messages: Message[];
  thoughtProcess?: ThoughtProcess[];
  metadata: {
    interfaceType: InterfaceType;
    changes: string[];
    context?: string;
    branchName?: string;
    tags?: string[];
  };
}

interface VersionDiff {
  added: Message[];
  removed: Message[];
  modified: Array<{
    before: Message;
    after: Message;
  }>;
  thoughtProcess?: {
    before?: ThoughtProcess[];
    after?: ThoughtProcess[];
  };
}

class VersionManager {
  private versions: Map<string, Map<string, VersionEntry>>;
  private maxVersionsPerConversation = 50;

  constructor() {
    this.versions = new Map();
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('version_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.versions = new Map(
          Object.entries(parsed).map(([convId, versions]) => [
            convId,
            new Map(Object.entries(versions))
          ])
        );
      }
    } catch (error) {
      console.error('Failed to load version history:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const serialized = Object.fromEntries(
        Array.from(this.versions.entries()).map(([convId, versions]) => [
          convId,
          Object.fromEntries(versions)
        ])
      );
      localStorage.setItem('version_history', JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to save version history:', error);
    }
  }

  public createVersion(
    conversationId: string,
    messages: Message[],
    interfaceType: InterfaceType,
    parentVersion?: string,
    thoughtProcess?: ThoughtProcess[],
    metadata: Partial<VersionEntry['metadata']> = {}
  ): string {
    let conversationVersions = this.versions.get(conversationId);
    if (!conversationVersions) {
      conversationVersions = new Map();
      this.versions.set(conversationId, conversationVersions);
    }

    const version = this.generateVersion();
    const entry: VersionEntry = {
      version,
      parentVersion,
      timestamp: Date.now(),
      messages: [...messages],
      thoughtProcess,
      metadata: {
        interfaceType,
        changes: [],
        ...metadata
      }
    };

    // Calculate changes if there's a parent version
    if (parentVersion) {
      const parentEntry = conversationVersions.get(parentVersion);
      if (parentEntry) {
        entry.metadata.changes = this.calculateChanges(
          parentEntry.messages,
          messages,
          parentEntry.thoughtProcess,
          thoughtProcess
        );
      }
    }

    conversationVersions.set(version, entry);

    // Cleanup old versions if needed
    if (conversationVersions.size > this.maxVersionsPerConversation) {
      const sortedVersions = Array.from(conversationVersions.entries())
        .sort(([, a], [, b]) => b.timestamp - a.timestamp);
      
      const toRemove = sortedVersions.slice(this.maxVersionsPerConversation);
      for (const [version] of toRemove) {
        conversationVersions.delete(version);
      }
    }

    this.saveToStorage();
    return version;
  }

  public getVersion(
    conversationId: string,
    version: string
  ): VersionEntry | undefined {
    return this.versions.get(conversationId)?.get(version);
  }

  public getVersionHistory(
    conversationId: string,
    limit?: number
  ): VersionEntry[] {
    const versions = Array.from(this.versions.get(conversationId)?.values() || [])
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return limit ? versions.slice(0, limit) : versions;
  }

  public getDiff(
    conversationId: string,
    fromVersion: string,
    toVersion: string
  ): VersionDiff | undefined {
    const conversationVersions = this.versions.get(conversationId);
    if (!conversationVersions) return undefined;

    const fromEntry = conversationVersions.get(fromVersion);
    const toEntry = conversationVersions.get(toVersion);
    if (!fromEntry || !toEntry) return undefined;

    return this.computeDiff(
      fromEntry.messages,
      toEntry.messages,
      fromEntry.thoughtProcess,
      toEntry.thoughtProcess
    );
  }

  public revertToVersion(
    conversationId: string,
    version: string,
    interfaceType: InterfaceType
  ): string | undefined {
    const conversationVersions = this.versions.get(conversationId);
    if (!conversationVersions) return undefined;

    const targetVersion = conversationVersions.get(version);
    if (!targetVersion) return undefined;

    // Create new version based on the target version
    return this.createVersion(
      conversationId,
      targetVersion.messages,
      interfaceType,
      version,
      targetVersion.thoughtProcess,
      {
        ...targetVersion.metadata,
        changes: ['Reverted to version ' + version]
      }
    );
  }

  private generateVersion(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private calculateChanges(
    oldMessages: Message[],
    newMessages: Message[],
    oldThoughtProcess?: ThoughtProcess[],
    newThoughtProcess?: ThoughtProcess[]
  ): string[] {
    const changes: string[] = [];

    // Compare messages
    if (newMessages.length > oldMessages.length) {
      changes.push(`Added ${newMessages.length - oldMessages.length} messages`);
    } else if (newMessages.length < oldMessages.length) {
      changes.push(`Removed ${oldMessages.length - newMessages.length} messages`);
    }

    // Compare thought process
    if (!oldThoughtProcess && newThoughtProcess) {
      changes.push('Added thought process');
    } else if (oldThoughtProcess && !newThoughtProcess) {
      changes.push('Removed thought process');
    } else if (oldThoughtProcess && newThoughtProcess) {
      if (oldThoughtProcess.length !== newThoughtProcess.length) {
        changes.push('Modified thought process');
      }
    }

    return changes;
  }

  private computeDiff(
    oldMessages: Message[],
    newMessages: Message[],
    oldThoughtProcess?: ThoughtProcess[],
    newThoughtProcess?: ThoughtProcess[]
  ): VersionDiff {
    const diff: VersionDiff = {
      added: [],
      removed: [],
      modified: [],
      thoughtProcess: {}
    };

    // Compare messages
    const oldSet = new Set(oldMessages.map(m => JSON.stringify(m)));
    const newSet = new Set(newMessages.map(m => JSON.stringify(m)));

    newMessages.forEach(message => {
      const stringified = JSON.stringify(message);
      if (!oldSet.has(stringified)) {
        diff.added.push(message);
      }
    });

    oldMessages.forEach(message => {
      const stringified = JSON.stringify(message);
      if (!newSet.has(stringified)) {
        diff.removed.push(message);
      }
    });

    // Compare thought process
    if (oldThoughtProcess || newThoughtProcess) {
      diff.thoughtProcess = {
        before: oldThoughtProcess,
        after: newThoughtProcess
      };
    }

    return diff;
  }
}

// Export singleton instance
export const versionManager = new VersionManager(); 