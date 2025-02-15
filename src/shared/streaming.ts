export class StreamManager {
  private static instance: StreamManager;
  private streams: Map<string, ReadableStream> = new Map();

  private constructor() {}

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  async streamResponse(
    url: string,
    messages: Array<{role: 'user'|'assistant', content: string}>,
    {
      onChunk,
      onError,
      onComplete
    }: {
      onChunk: (chunk: {type: 'content'|'thought', content?: string, thought?: object}) => void,
      onError: (error: Error) => void,
      onComplete: () => void
    }
  ) {
    try {
      const formattedMessages = [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond in markdown when appropriate.'
        },
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ messages: formattedMessages })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        try {
          const parsed = JSON.parse(chunk);
          onChunk(parsed);
        } catch (e) {
          onChunk({ type: 'content', content: chunk });
        }
      }

      onComplete();
    } catch (error) {
      onError(error as Error);
    }
  }

  createStream(id: string): ReadableStream {
    const stream = new ReadableStream({
      start(controller) {
        // Stream implementation
      }
    });
    this.streams.set(id, stream);
    return stream;
  }
}
