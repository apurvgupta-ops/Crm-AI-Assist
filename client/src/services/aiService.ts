export interface ChatRequest {
  message: string;
  conversation_id?: string;
  context?: {
    user_id?: string;
    session_id?: string;
    metadata?: Record<string, any>;
  };
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  _id: string;
  timestamp: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  data: {
    _id: string;
    sessionId: string;
    history: ChatHistoryMessage[];
    lastActive: string;
    __v: number;
  }[];
}

class AIService {
  private baseUrl = 'http://localhost:3001/api/v1';
  // private baseUrl = 'https://crm-agentapp.24livehost.com/api/v1';
  
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/query/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw new Error('Failed to get AI response. Please try again.');
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatHistoryResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/query/chat-history?sessionId=${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw new Error('Failed to load chat history.');
    }
  }

  // Helper method to check if the API is available
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const aiService = new AIService();
