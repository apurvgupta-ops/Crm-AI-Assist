import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Send, MessageSquare, X, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your CRM assistant. I can help you with customer data, analytics, and workflow automation. How can I assist you today?",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");

  const sendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getAIResponse(inputValue),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const getAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('contact') || input.includes('customer')) {
      return "I can help you manage contacts! You currently have 2,847 contacts in your CRM. Would you like me to help you add a new contact, search for someone specific, or generate a contact report?";
    } else if (input.includes('deal') || input.includes('sale')) {
      return "You have 156 active deals worth $2.4M in total. 23 deals are scheduled to close this week. Would you like me to show you the highest priority deals or help you update a deal status?";
    } else if (input.includes('report') || input.includes('analytics')) {
      return "I can generate various reports for you: sales performance, contact engagement, deal pipeline, or revenue analytics. Which type of report would you like me to create?";
    } else if (input.includes('schedule') || input.includes('meeting')) {
      return "I can help you schedule meetings! You have 3 meetings today and 7 this week. Would you like me to schedule a new meeting or show your upcoming calendar?";
    } else {
      return "I understand you're looking for help with your CRM. I can assist with contacts, deals, analytics, scheduling, and more. Could you be more specific about what you'd like to do?";
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-primary rounded-full shadow-floating flex items-center justify-center text-white hover:scale-110 transition-all duration-300 animate-float z-50"
      >
        <Bot size={24} />
      </button>
    );
  }

  return (
    <Card className={cn(
      "fixed right-6 bg-card shadow-elevated z-50 transition-all duration-300",
      isMinimized ? "bottom-6 w-80 h-16" : "bottom-6 w-96 h-[600px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Assistant</h3>
            <p className="text-xs text-success">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <Minimize2 size={16} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 p-4 space-y-4 max-h-[460px] overflow-y-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.sender === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg text-sm",
                    message.sender === 'user'
                      ? "bg-gradient-primary text-white"
                      : "bg-muted text-foreground"
                  )}
                >
                  <p>{message.text}</p>
                  <p className={cn(
                    "text-xs mt-1 opacity-70",
                    message.sender === 'user' ? "text-white" : "text-muted-foreground"
                  )}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ask me anything about your CRM..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage}
                className="bg-gradient-primary hover:opacity-90 text-white p-2"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}