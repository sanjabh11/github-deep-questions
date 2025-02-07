import { InterfaceType, QueryType } from '../../../shared/prompts';
import { Message, ThoughtProcess } from '../../../shared/types';
import { conversationStore } from '../storage/conversationStore';
import { versionManager } from '../version/versionManager';

interface ResponseContext {
  conversationId: string;
  interfaceType: InterfaceType;
  queryType: QueryType;
  currentMessage: Message;
  thoughtProcess?: ThoughtProcess[];
  files?: Array<{ name: string; content: string }>;
}

interface FollowUpConfig {
  maxFollowUps: number;
  requireContext: boolean;
  allowArchitectReview: boolean;
}

class ResponseManager {
  private followUpConfigs: Record<InterfaceType, FollowUpConfig> = {
    GENERAL: {
      maxFollowUps: 3,
      requireContext: false,
      allowArchitectReview: false
    },
    RESEARCHER: {
      maxFollowUps: 5,
      requireContext: true,
      allowArchitectReview: true
    },
    CODER: {
      maxFollowUps: 4,
      requireContext: true,
      allowArchitectReview: true
    }
  };

  public async handleFollowUp(
    context: ResponseContext,
    question: string
  ): Promise<Message> {
    const config = this.followUpConfigs[context.interfaceType];
    const conversation = conversationStore.getConversation(
      context.interfaceType,
      context.conversationId
    );

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Check follow-up limits
    if (conversation.metadata.followUpCount >= config.maxFollowUps) {
      return {
        type: 'system',
        content: `Maximum follow-up limit (${config.maxFollowUps}) reached for this conversation. Please start a new conversation.`,
        timestamp: Date.now()
      };
    }

    // Build context for follow-up
    const contextualQuestion = this.buildFollowUpContext(
      conversation.messages,
      question,
      config.requireContext
    );

    // Create follow-up message
    const followUpMessage: Message = {
      type: 'user',
      content: contextualQuestion,
      timestamp: Date.now()
    };

    // Update conversation
    conversationStore.addMessage(
      context.interfaceType,
      context.conversationId,
      followUpMessage
    );

    conversationStore.updateMetadata(
      context.interfaceType,
      context.conversationId,
      {
        followUpCount: (conversation.metadata.followUpCount || 0) + 1
      }
    );

    return followUpMessage;
  }

  public async handleReasoning(
    context: ResponseContext
  ): Promise<ThoughtProcess[]> {
    const conversation = conversationStore.getConversation(
      context.interfaceType,
      context.conversationId
    );

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Generate reasoning steps
    const reasoning: ThoughtProcess[] = [
      {
        type: 'thinking',
        content: 'Analyzing the current context and requirements...',
        timestamp: Date.now()
      },
      {
        type: 'planning',
        content: 'Breaking down the problem into manageable steps...',
        timestamp: Date.now() + 1
      },
      {
        type: 'analyzing',
        content: 'Evaluating potential approaches and trade-offs...',
        timestamp: Date.now() + 2
      },
      {
        type: 'solving',
        content: 'Formulating a comprehensive solution...',
        timestamp: Date.now() + 3
      }
    ];

    // Update conversation with reasoning
    conversationStore.addMessage(
      context.interfaceType,
      context.conversationId,
      {
        type: 'reasoning',
        content: reasoning.map(r => r.content).join('\n\n'),
        timestamp: Date.now()
      },
      reasoning
    );

    return reasoning;
  }

  public async handleExamples(
    context: ResponseContext,
    count: number = 3
  ): Promise<Message> {
    const conversation = conversationStore.getConversation(
      context.interfaceType,
      context.conversationId
    );

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Generate examples based on interface type
    let examples: string;
    switch (context.interfaceType) {
      case 'CODER':
        examples = this.generateCodeExamples(context, count);
        break;
      case 'RESEARCHER':
        examples = this.generateResearchExamples(context, count);
        break;
      default:
        examples = this.generateGeneralExamples(context, count);
    }

    const exampleMessage: Message = {
      type: 'answer',
      content: examples,
      timestamp: Date.now()
    };

    // Update conversation
    conversationStore.addMessage(
      context.interfaceType,
      context.conversationId,
      exampleMessage
    );

    return exampleMessage;
  }

  public async handleArchitectReview(
    context: ResponseContext
  ): Promise<Message> {
    const config = this.followUpConfigs[context.interfaceType];
    if (!config.allowArchitectReview) {
      return {
        type: 'system',
        content: 'Architect review is not available for this interface type.',
        timestamp: Date.now()
      };
    }

    const conversation = conversationStore.getConversation(
      context.interfaceType,
      context.conversationId
    );

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Generate architect review
    const review = this.generateArchitectReview(context);

    const reviewMessage: Message = {
      type: 'answer',
      content: review,
      timestamp: Date.now()
    };

    // Update conversation
    conversationStore.addMessage(
      context.interfaceType,
      context.conversationId,
      reviewMessage
    );

    conversationStore.updateMetadata(
      context.interfaceType,
      context.conversationId,
      {
        hasArchitectReview: true
      }
    );

    return reviewMessage;
  }

  private buildFollowUpContext(
    messages: Message[],
    question: string,
    requireContext: boolean
  ): string {
    if (!requireContext) {
      return question;
    }

    const relevantMessages = messages
      .slice(-3) // Get last 3 messages for context
      .map(m => `${m.type.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    return `Previous context:\n${relevantMessages}\n\nFollow-up question: ${question}`;
  }

  private generateCodeExamples(context: ResponseContext, count: number): string {
    // Implementation would generate code examples based on the context
    return `Here are ${count} code examples:\n\n[Example implementations would go here]`;
  }

  private generateResearchExamples(context: ResponseContext, count: number): string {
    // Implementation would generate research examples based on the context
    return `Here are ${count} research examples:\n\n[Example findings would go here]`;
  }

  private generateGeneralExamples(context: ResponseContext, count: number): string {
    // Implementation would generate general examples based on the context
    return `Here are ${count} examples:\n\n[General examples would go here]`;
  }

  private generateArchitectReview(context: ResponseContext): string {
    // Implementation would generate an architect review based on the context
    return `Architect Review:\n\n[Detailed review would go here]`;
  }
}

// Export singleton instance
export const responseManager = new ResponseManager(); 