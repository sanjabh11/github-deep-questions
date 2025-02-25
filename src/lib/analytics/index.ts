import { Message, FollowUpQuestion } from '../types';

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private version: string = '1.0.0';
  private isEnabled: boolean = false;

  private constructor() {
    // Initialize analytics if gtag is available
    this.isEnabled = typeof window !== 'undefined' && !!window.gtag;
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public trackEvent(event: AnalyticsEvent): void {
    if (!this.isEnabled) return;

    window.gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      version: this.version,
      ...event.metadata
    });
  }

  public trackFollowUpGeneration(questions: FollowUpQuestion[]): void {
    this.trackEvent({
      category: 'interaction',
      action: 'generate_followup',
      label: 'follow_up_questions',
      value: questions.length,
      metadata: {
        average_relevance: questions.reduce((acc, q) => acc + q.relevance, 0) / questions.length,
        has_context: questions.every(q => !!q.context)
      }
    });
  }

  public trackFollowUpSelection(question: FollowUpQuestion): void {
    this.trackEvent({
      category: 'interaction',
      action: 'select_followup',
      label: question.question,
      value: Math.round(question.relevance * 100),
      metadata: {
        question_id: question.id,
        context: question.context
      }
    });
  }

  public trackConversationReset(): void {
    this.trackEvent({
      category: 'interaction',
      action: 'reset_conversation',
      label: 'clear_history'
    });
  }

  public trackError(error: Error, context: string): void {
    this.trackEvent({
      category: 'error',
      action: 'interaction_error',
      label: error.message,
      metadata: {
        error_type: error.name,
        context,
        stack: error.stack
      }
    });
  }

  public setVersion(version: string): void {
    this.version = version;
  }

  public getVersion(): string {
    return this.version;
  }
}

export const analytics = AnalyticsService.getInstance(); 