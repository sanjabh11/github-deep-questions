import { Message } from '../types';

export const streamResponse = async (messages: Message[]) => {
  try {
    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    // ... rest of the existing stream handling code ...
  } catch (error) {
    console.error('Error streaming response:', error);
    throw error;
  }
};
