import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, X, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

interface RoomChatProps {
  roomId?: string;
  isHost: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function RoomChat({ roomId, isHost, isOpen, onClose }: RoomChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dir = document.dir || 'rtl';

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`chat_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'new_message' }, (payload) => {
      setMessages((prev) => [...prev, payload.payload.message]);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !channelRef.current) return;

    const msg: Message = {
      id: Math.random().toString(36).substring(2),
      text: newMessage,
      sender: isHost ? 'المضيف' : 'زائر',
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, msg]);
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'new_message',
      payload: { message: msg }
    });

    setNewMessage('');
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-[100] md:hidden backdrop-blur-sm" onClick={onClose} />}
      
      {/* Sliding Sidebar */}
      <div className={`fixed top-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} h-full w-[85%] sm:w-96 bg-slate-900 border-${dir === 'rtl' ? 'r' : 'l'} border-slate-700 shadow-2xl z-[101] transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : (dir === 'rtl' ? '-translate-x-full' : 'translate-x-full')}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
          <h3 className="text-white font-bold flex items-center gap-2"><MessageCircle className="w-5 h-5 text-cyan-400"/> الدردشة</h3>
          <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 transition-colors"><X className="w-4 h-4"/></button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0f172a]">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">لا توجد رسائل بعد. ابدأ المحادثة!</div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender === (isHost ? 'المضيف' : 'زائر');
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-1 px-1">{msg.sender}</span>
                  <div className={`max-w-[85%] px-4 py-2 text-sm shadow-md ${isMe ? 'bg-cyan-600 text-white rounded-2xl rounded-tl-sm' : 'bg-slate-700 text-white rounded-2xl rounded-tr-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-800 border-t border-slate-700">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..." 
              className="flex-1 bg-slate-900 border border-slate-600 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              dir="auto"
            />
            <button type="submit" disabled={!newMessage.trim()} className="p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 rounded-full text-white transition-all shadow-lg active:scale-95">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
