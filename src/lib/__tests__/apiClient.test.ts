import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../apiClient';
import { withRetry } from '../retry';

// Mock the retry utility
vi.mock('../retry', () => ({
  withRetry: vi.fn((fn) => fn())
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock EventSource
class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {}

  // Helper to simulate messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  // Helper to simulate errors
  simulateError() {
    if (this.onerror) {
      this.onerror();
    }
  }
}

global.EventSource = MockEventSource as any;

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('process', () => {
    it('should handle successful streaming response', async () => {
      const onThinking = vi.fn();
      const onProgress = vi.fn();

      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true }) };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const processPromise = apiClient.process(
        {
          query: 'test',
          interfaceType: 'GENERAL',
          queryType: 'CODE'
        },
        onThinking,
        onProgress
      );

      // Simulate streaming events
      const eventSource = new MockEventSource('/api/process');
      
      eventSource.simulateMessage({
        type: 'thinking',
        content: 'Processing request...'
      });

      eventSource.simulateMessage({
        type: 'progress',
        content: '50% complete'
      });

      eventSource.simulateMessage({
        type: 'complete',
        data: { success: true, data: { content: 'Done' } }
      });

      const result = await processPromise;

      expect(result).toEqual({ success: true, data: { content: 'Done' } });
      expect(onThinking).toHaveBeenCalledWith({
        type: 'thinking',
        content: 'Processing request...',
        timestamp: expect.any(Number)
      });
      expect(onProgress).toHaveBeenCalledWith('50% complete');
      expect(eventSource.close).toHaveBeenCalled();
    });

    it('should handle API errors correctly', async () => {
      const mockResponse = { 
        ok: false, 
        status: 401,
        json: () => Promise.resolve({ message: 'API key required' })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiClient.process({
        query: 'test',
        interfaceType: 'GENERAL',
        queryType: 'CODE'
      })).rejects.toThrow('API key required');
    });
  });

  describe('architectReview', () => {
    it('should handle successful review', async () => {
      const mockReview = {
        criticalIssues: [],
        potentialProblems: [],
        improvements: [],
        verdict: 'APPROVED'
      };

      const mockResponse = { 
        ok: true, 
        json: () => Promise.resolve(mockReview)
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.architectReview([], 'CODE');
      expect(result).toEqual(mockReview);
    });
  });

  describe('generateSpeech', () => {
    it('should handle successful speech generation', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.generateSpeech('test');
      expect(result).toEqual(mockResponse);
    });
  });
}); 