import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Index from './Index';
import { apiClient } from '@/lib/apiClient';
import { storage } from '@/lib/storage';
import type { Mock } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    process: vi.fn()
  }
}));

vi.mock('@/lib/storage', () => ({
  storage: {
    loadChatHistory: vi.fn(),
    saveChatHistory: vi.fn(),
    loadChatMode: vi.fn(),
    loadTemporaryFiles: vi.fn(),
    saveChatMode: vi.fn()
  }
}));

// Type assertions for mocked functions
const mockedStorage = storage as unknown as {
  loadChatHistory: Mock;
  saveChatHistory: Mock;
  loadChatMode: Mock;
  loadTemporaryFiles: Mock;
  saveChatMode: Mock;
};

const mockedApiClient = apiClient as unknown as {
  process: Mock;
};

describe('Index Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockedStorage.loadChatHistory.mockResolvedValue({ messages: [] });
    mockedStorage.loadChatMode.mockReturnValue('general');
    mockedStorage.loadTemporaryFiles.mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    render(<Index />);
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  it('loads initial state correctly', async () => {
    const mockMessages = [
      { type: 'user', content: 'Hello', timestamp: Date.now() },
      { type: 'answer', content: 'Hi there!', timestamp: Date.now() }
    ];

    mockedStorage.loadChatHistory.mockResolvedValue({ messages: mockMessages });
    mockedStorage.loadChatMode.mockReturnValue('researcher');

    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  it('handles mode changes', async () => {
    render(<Index />);

    const researcherButton = screen.getByText('Deep Researcher');
    fireEvent.click(researcherButton);

    expect(mockedStorage.saveChatMode).toHaveBeenCalledWith('researcher');
  });

  it('handles mode and query type changes', async () => {
    render(<Index />);

    // Test mode change
    const researcherButton = screen.getByText('Deep Researcher');
    fireEvent.click(researcherButton);
    expect(mockedStorage.saveChatMode).toHaveBeenCalledWith('researcher');

    // Test query type change
    const explanationButton = screen.getByText('Explanation');
    fireEvent.click(explanationButton);

    // Send a message and verify the request includes the selected mode and query type
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockedApiClient.process).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Test message',
          interfaceType: 'RESEARCHER',
          queryType: 'EXPLANATION'
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  it('sends messages and handles responses', async () => {
    const mockResponse = {
      success: true,
      data: {
        thinking: 'I am thinking...',
        analysis: 'Here is my analysis'
      }
    };

    mockedApiClient.process.mockResolvedValue(mockResponse);

    render(<Index />);

    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockedApiClient.process).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Test message',
          interfaceType: 'GENERAL',
          queryType: 'CODE'
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Here is my analysis')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const mockError = new Error('API Error');
    mockedApiClient.process.mockRejectedValue(mockError);

    render(<Index />);

    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Error: API Error')).toBeInTheDocument();
    });
  });

  it('shows progress indicator while loading', async () => {
    mockedApiClient.process.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<Index />);

    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
  });
}); 