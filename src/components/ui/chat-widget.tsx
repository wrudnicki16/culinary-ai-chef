import { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi there! Need help finding a recipe or have questions about dietary restrictions?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const toggleChat = () => setIsOpen(!isOpen);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);
    
    try {
      // Send message to backend
      const response = await apiRequest('POST', '/api/chat', { message: message.trim() });
      const data = await response.json();
      
      // Add response to chat
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: data.message,
        isUser: false,
        timestamp: new Date()
      }]);
    } catch (error) {
      toast({
        title: "Error sending message",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Button 
        onClick={toggleChat} 
        className="rounded-full p-3 shadow-lg bg-primary hover:bg-primary/90"
        size="icon"
      >
        <MessageCircle size={24} />
      </Button>
      
      {isOpen && (
        <Card className="absolute bottom-16 right-0 w-80 shadow-xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground p-4 flex flex-row justify-between items-center">
            <h3 className="font-medium">Recipe Support</h3>
            <Button variant="ghost" size="icon" onClick={toggleChat} className="text-primary-foreground hover:text-primary-foreground/90 h-auto w-auto p-1">
              <X size={16} />
            </Button>
          </CardHeader>
          <div className="h-72 overflow-y-auto p-4 space-y-3 bg-muted/50">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex items-start space-x-2 ${msg.isUser ? 'justify-end' : ''}`}
              >
                <div 
                  className={`p-2 rounded-lg max-w-[85%] ${
                    msg.isUser 
                      ? 'bg-muted rounded-tr-none' 
                      : 'bg-primary/10 text-foreground rounded-tl-none'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <CardContent className="p-3 border-t">
            <div className="flex space-x-2">
              <Input 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 rounded-full text-sm py-2"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSendMessage}
                className="rounded-full p-2 bg-primary hover:bg-primary/90"
                size="icon"
                disabled={isLoading}
              >
                <Send size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
