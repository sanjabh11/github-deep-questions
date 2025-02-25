import { ArchitectReview } from "../architectReviewer";

export class ArchitectVersionManager {
  private versionHistory: ArchitectReview[] = [];
  private maxHistoryLength: number = 10;

  constructor(maxHistoryLength: number = 10) {
    this.maxHistoryLength = maxHistoryLength;
  }

  public saveVersion(review: ArchitectReview): void {
    this.versionHistory.unshift(review);
    
    // Keep history within limit
    if (this.versionHistory.length > this.maxHistoryLength) {
      this.versionHistory = this.versionHistory.slice(0, this.maxHistoryLength);
    }
  }

  public getVersionHistory(): ArchitectReview[] {
    return [...this.versionHistory];
  }

  public revertToVersion(version: string): ArchitectReview | null {
    const targetVersion = this.versionHistory.find(v => v.version === version);
    if (!targetVersion) {
      return null;
    }
    return { ...targetVersion };
  }

  public clearHistory(): void {
    this.versionHistory = [];
  }
} 