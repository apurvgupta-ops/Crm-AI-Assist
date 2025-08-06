import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Send, X, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiService, ChatHistoryMessage } from "../services/aiService";

interface Message {
    id: string;
    text: string;
    sender: "user" | "ai";
    timestamp: Date;
    isFormatted?: boolean;
    responseType?: "leads" | "query" | "explanation" | "error";
}

// Capitalize helper
function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Flatten nested objects with dot notation keys (e.g. company.industry)
function flattenObject(obj: any, prefix = ""): Record<string, any> {
    return Object.keys(obj).reduce((acc, key) => {
        const pre = prefix.length ? prefix + "." : "";
        if (
            obj[key] !== null &&
            typeof obj[key] === "object" &&
            !Array.isArray(obj[key])
        ) {
            Object.assign(acc, flattenObject(obj[key], pre + key));
        } else {
            acc[pre + key] = obj[key];
        }
        return acc;
    }, {} as Record<string, any>);
}

// Field to emoji mapping for UI clarity
const fieldIcons: Record<string, string> = {
    firstName: "👤",
    lastName: "👤",
    email: "📧",
    phone: "📞",
    status: "📊",
    budget: "💰",
    company: "🏢",
    // add more icon mappings if needed
};

function getIcon(key: string) {
    if (fieldIcons[key]) return fieldIcons[key];
    const rootKey = key.split(".")[0];
    return fieldIcons[rootKey] || "";
}

// Message type detection helper
const detectMessageType = (
    content: string
): { responseType: "leads" | "query" | "explanation" | "error"; isFormatted: boolean } => {
    if (content.includes("📋 Lead #") || content.includes("✅ Found") || content.includes("👤 Name:")) {
        return { responseType: "leads", isFormatted: false };
    }
    return { responseType: "explanation", isFormatted: false };
};

export function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const sessionId = "123456"; // Make this dynamic if needed
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load chat history on open
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            loadChatHistory();
        }
    }, [isOpen]);

    // Auto-scroll on new messages if chat open and not minimized
    useEffect(() => {
        if (isOpen && !isMinimized && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen, isMinimized]);

    // Load chat history from backend service
    const loadChatHistory = async () => {
        setIsLoading(true);
        try {
            const historyResponse = await aiService.getChatHistory(sessionId);
            if (historyResponse.success && historyResponse.data.length > 0) {
                const historyMessages = historyResponse.data[0].history;
                const convertedMessages: Message[] = historyMessages.map((msg: ChatHistoryMessage) => {
                    const messageType =
                        msg.role === "assistant"
                            ? detectMessageType(msg.content)
                            : { responseType: "explanation" as const, isFormatted: false };
                    return {
                        id: msg._id,
                        text: msg.content,
                        sender: msg.role === "user" ? "user" : "ai",
                        timestamp: new Date(msg.timestamp),
                        responseType: messageType.responseType,
                        isFormatted: messageType.isFormatted,
                    };
                });
                setMessages(convertedMessages);
            } else {
                // Welcome message if no history exists
                setMessages([
                    {
                        id: "1",
                        text: "Hello! I'm your CRM assistant. I can help you with customer data, analytics, and workflow automation. How can I assist you today?",
                        sender: "ai",
                        timestamp: new Date(),
                        responseType: "explanation",
                    },
                ]);
            }
        } catch (error) {
            console.error("Failed to load chat history:", error);
            setMessages([
                {
                    id: "1",
                    text: "Hello! I'm your CRM assistant. I can help you with customer data, analytics, and workflow automation. How can I assist you today?",
                    sender: "ai",
                    timestamp: new Date(),
                    responseType: "explanation",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Send user message and handle AI response
    const sendMessage = () => {
        if (!inputValue.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const messageToSend = inputValue;
        setInputValue("");

        aiService
            .sendChatMessage({
                message: messageToSend,
                context: { session_id: sessionId },
            })
            .then((response) => {
                let aiResponse: Message;
                let responseText = "";

                if (response && typeof response === "object") {
                    if (response.success && response.data && response.data.length > 0) {
                        const dataItem = response.data[0];
                        if (dataItem.results && Array.isArray(dataItem.results) && dataItem.results.length > 0) {
                            // Format leads dynamically
                            const leadsText = dataItem.results
                                .map((lead: any, index: number) => {
                                    const flatLead = flattenObject(lead);
                                    return (
                                        `📋 Lead #${index + 1}\n` +
                                        Object.entries(flatLead)
                                            .map(([key, val]) => {
                                                const icon = getIcon(key);
                                                const label = capitalize(key.split(".").slice(-1)[0]);
                                                return `${icon} ${label}: ${val ?? "N/A"}`;
                                            })
                                            .join("\n")
                                    );
                                })
                                .join("\n\n");

                            responseText = `✅ Found ${dataItem.results.length} lead(s):\n\n${leadsText}`;

                            aiResponse = {
                                id: (Date.now() + 1).toString(),
                                text: responseText,
                                sender: "ai",
                                timestamp: new Date(),
                                responseType: "leads",
                                isFormatted: false,
                            };
                        } else if (dataItem.explanation) {
                            responseText = dataItem.explanation;
                            aiResponse = {
                                id: (Date.now() + 1).toString(),
                                text: responseText,
                                sender: "ai",
                                timestamp: new Date(),
                                responseType: "explanation",
                                isFormatted: false,
                            };
                        } else {
                            responseText = JSON.stringify(dataItem, null, 2);
                            aiResponse = {
                                id: (Date.now() + 1).toString(),
                                text: responseText,
                                sender: "ai",
                                timestamp: new Date(),
                                isFormatted: true,
                                responseType: "query",
                            };
                        }
                    } else {
                        responseText = JSON.stringify(response, null, 2);
                        aiResponse = {
                            id: (Date.now() + 1).toString(),
                            text: responseText,
                            sender: "ai",
                            timestamp: new Date(),
                            isFormatted: true,
                            responseType: "query",
                        };
                    }
                } else if (typeof response === "string") {
                    responseText = response;
                    aiResponse = {
                        id: (Date.now() + 1).toString(),
                        text: responseText,
                        sender: "ai",
                        timestamp: new Date(),
                        responseType: "explanation",
                    };
                } else {
                    aiResponse = {
                        id: (Date.now() + 1).toString(),
                        text: "I received your message but couldn't generate a proper response. Please try again.",
                        sender: "ai",
                        timestamp: new Date(),
                        responseType: "error",
                    };
                }

                setMessages((prev) => [...prev, aiResponse]);
            })
            .catch((error) => {
                console.error("Failed to get AI response:", error);
                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: "Failed to get AI response. Please try again.",
                    sender: "ai",
                    timestamp: new Date(),
                    responseType: "error",
                };
                setMessages((prev) => [...prev, errorMessage]);
            });
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-primary rounded-full shadow-floating flex items-center justify-center text-white hover:scale-110 transition-all duration-300 animate-float z-50"
                aria-label="Open AI Chat"
            >
                <Bot size={24} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="bg-white rounded-lg overflow-hidden shadow-xl w-[1000px] h-[800px] flex flex-col">
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
                            aria-label={isMinimized ? "Restore chat" : "Minimize chat"}
                        >
                            <Minimize2 size={16} className="text-muted-foreground" />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            aria-label="Close chat"
                        >
                            <X size={16} className="text-muted-foreground" />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Messages */}
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-20">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                    <span className="ml-2 text-sm text-muted-foreground">Loading chat history...</span>
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex",
                                            message.sender === "user" ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[85%] p-4 rounded-lg text-sm shadow-sm",
                                                message.sender === "user"
                                                    ? "bg-gradient-primary text-white"
                                                    : "bg-white border border-gray-200 text-gray-800"
                                            )}
                                        >
                                            {message.isFormatted ? (
                                                <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-50 p-3 rounded border overflow-x-auto text-gray-700">
                                                    {message.text}
                                                </pre>
                                            ) : message.responseType === "leads" ? (
                                                <div className="space-y-4">
                                                    {message.text.split("\n\n").map((leadBlock, index) => (
                                                        <div key={index} className="p-3 border border-gray-300 rounded-md">
                                                            {leadBlock.split("\n").map((line, idx) => {
                                                                const trimmedLine = line.trim();
                                                                if (!trimmedLine) return <div key={idx} className="h-1" />;
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className={
                                                                            trimmedLine.startsWith("📋 Lead #")
                                                                                ? "font-semibold text-blue-600 mb-1"
                                                                                : "ml-2 text-gray-700"
                                                                        }
                                                                    >
                                                                        {trimmedLine}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</div>
                                            )}
                                            <p
                                                className={cn(
                                                    "text-xs mt-3 opacity-70 pt-2 border-t",
                                                    message.sender === "user"
                                                        ? "text-white border-white/20"
                                                        : "text-gray-500 border-gray-200"
                                                )}
                                            >
                                                {message.timestamp.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input section */}
                        <div className="p-4 border-t border-border/50">
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Ask me anything about your CRM..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === "Enter") sendMessage();
                                    }}
                                    className="flex-1"
                                    aria-label="Type your message"
                                />
                                <Button onClick={sendMessage} className="bg-gradient-primary hover:opacity-90 text-white p-2" aria-label="Send message">
                                    <Send size={16} />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}
