import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Maximize2, Minimize2, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { useSendChatMessage } from '@/hooks/useApi';
import type { ChatMessage, ChatSource } from '@/types';

interface AIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ isOpen, onClose, isExpanded, onToggleExpand }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi! I'm your Signal AI assistant powered by Cloudflare's AI Search and Workers AI. I can help you explore customer feedback insights.

Try asking me:
• "What are the top trending issues?"
• "Tell me about Workers KV problems"
• "Which enterprise customers are affected?"
• "What's the overall sentiment today?"`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessageMutation = useSendChatMessage();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessageMutation.isPending) return;

    const userMessage = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await sendMessageMutation.mutateAsync({
        message: userMessage,
        conversationId: conversationId || undefined,
      });

      if (response.conversationId) setConversationId(response.conversationId);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const suggestedQuestions = [
    'What are the critical issues today?',
    'Tell me about Turnstile problems',
    'Which customers need attention?',
    'Top feature requests',
  ];

  if (!isOpen) return null;

  return (
    <div className={`fixed ${isExpanded ? 'inset-4' : 'bottom-4 right-4 w-96 h-[600px]'} bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-2xl">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Signal AI Assistant</h3>
            <p className="text-xs text-orange-100">Powered by Cloudflare AI Search</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button onClick={onToggleExpand} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            {isExpanded ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start space-x-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user' ? 'bg-orange-500' : 'bg-gray-100'}`}>
                {message.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-orange-600" />}
              </div>
              <div>
                <div className={`rounded-2xl px-4 py-2.5 ${message.role === 'user' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Sources:</p>
                    {message.sources.map((source, idx) => (
                      <SourceBadge key={idx} source={source} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {sendMessageMutation.isPending && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-orange-600" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, idx) => (
              <button key={idx} onClick={() => setInput(q)} className="text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about feedback insights..."
            className="flex-1 px-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sendMessageMutation.isPending}
            className="w-10 h-10 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 rounded-xl flex items-center justify-center transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
};

const SourceBadge: React.FC<{ source: ChatSource }> = ({ source }) => {
  const typeColors: Record<string, string> = {
    feedback: 'bg-blue-100 text-blue-700',
    theme: 'bg-purple-100 text-purple-700',
    customer: 'bg-green-100 text-green-700',
  };

  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs ${typeColors[source.type] || 'bg-gray-100 text-gray-700'}`}>
      <span className="capitalize">{source.type}:</span>
      <span className="font-medium truncate max-w-[150px]">{source.title}</span>
      <ExternalLink className="w-3 h-3" />
    </div>
  );
};

export default AIChatbot;
