import { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Habari! Ninaweza kukusaidiaje leo kuhusu masuala ya madini?", isUser: false }
  ]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      isUser: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch(`${API_BASE}/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();

      const aiMessage: Message = {
        id: Date.now() + 1,
        text: data.reply,
        isUser: false,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white shadow-sm p-4">
        <h1 className="text-xl font-bold text-emerald-900 text-center">Msaidizi wa AI</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                message.isUser
                  ? 'bg-dark-emerald text-white'
                  : 'bg-white text-gray-800 shadow-sm'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Andika ujumbe wako..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-emerald"
          />
          <button
            onClick={handleSend}
            className="bg-dark-emerald text-white px-6 py-3 rounded-lg font-semibold hover:bg-deep-green transition-colors"
          >
            Tuma
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
