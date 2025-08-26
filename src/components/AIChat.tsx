import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Send, Bot, User, Loader2, Globe, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SearchSource {
  title: string;
  snippet: string;
  link: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: SearchSource[];
  isRealTime?: boolean;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChat = ({ isOpen, onClose }: AIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! मैं आपका AI Assistant हूं। मैं real-time information के साथ आपकी किसी भी query में help कर सकता हूं। आप मुझसे current news, market updates, weather, या कुछ भी पूछ सकते हैं!',
      sender: 'bot',
      timestamp: new Date(),
      isRealTime: true
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const generateAIResponse = async (userMessage: string): Promise<{ response: string; sources?: SearchSource[] }> => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { message: userMessage, includeSearch: true }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to get AI response');
      }

      return {
        response: data.response || 'Sorry, I encountered an error processing your request.',
        sources: data.sources || undefined
      };
    } catch (error) {
      console.error('AI response error:', error);
      // Fallback response
      return {
        response: 'मुझे खुशी होगी आपकी help करने में! कृपया अपना सवाल दोबारा पूछें या थोड़ी देर बाद try करें।'
      };
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const { response, sources } = await generateAIResponse(userMessage);
      
      const newBotMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: new Date(),
        sources: sources,
        isRealTime: Boolean(sources && sources.length > 0)
      };

      setMessages(prev => [...prev, newBotMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (text: string) => {
    return text.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-primary rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  Live
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  Real-time
                </Badge>
                <span className="text-xs text-muted-foreground">OpenAI + Web Search</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {message.sender === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className={`max-w-[80%] ${
                    message.sender === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    <div className={`rounded-lg p-3 text-sm ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      {formatMessage(message.text)}
                      {message.isRealTime && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Real-time information</span>
                        </div>
                      )}
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-muted-foreground font-medium">Sources:</div>
                        {message.sources.slice(0, 2).map((source, idx) => (
                          <div key={idx} className="text-xs bg-muted/50 rounded p-2">
                            <div className="font-medium text-foreground truncate">{source.title}</div>
                            <div className="text-muted-foreground mt-1 line-clamp-2">{source.snippet}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Typing...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          <div className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="कुछ भी पूछें - current news, weather, market info..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputText.trim() || isLoading}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              🤖 AI Assistant with real-time web search • OpenAI + Live Data
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};