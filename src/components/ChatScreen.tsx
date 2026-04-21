import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { ArrowLeft, Send, Mic, Square } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ChatScreen({ currentUser, contact, onClose, language }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const subscription = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new;
        if (
          (msg.sender_id === currentUser.id && msg.receiver_id === contact.id) ||
          (msg.sender_id === contact.id && msg.receiver_id === currentUser.id)
        ) {
          setMessages(prev => [...prev, msg]);
          scrollToBottom();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [contact.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    
    if (data) {
      setMessages(data);
      scrollToBottom();
    }
  };

  const handleSendText = async () => {
    if (!newMessage.trim()) return;
    
    const msg = {
      sender_id: currentUser.id,
      receiver_id: contact.id,
      content: newMessage,
      type: 'text'
    };
    
    setNewMessage("");
    await supabase.from('messages').insert([msg]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `${currentUser.id}_${Date.now()}.webm`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('chat_media')
          .upload(fileName, audioBlob);
          
        if (data) {
          const { data: publicUrlData } = supabase.storage.from('chat_media').getPublicUrl(fileName);
          
          await supabase.from('messages').insert([{
            sender_id: currentUser.id,
            receiver_id: contact.id,
            content: publicUrlData.publicUrl,
            type: 'voice'
          }]);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  return (
    <div className={cn("absolute inset-0 z-50 bg-slate-950 flex flex-col font-sans", language === "ar" ? "rtl" : "ltr")}>
      {/* Header */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4">
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={contact.photo_url} className="w-10 h-10 rounded-full" alt="" />
        <div>
          <h3 className="text-white font-bold">{contact.display_name}</h3>
          <p className="text-slate-500 text-xs">{contact.phone_number}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id || i} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[70%] rounded-2xl p-3", isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-800 text-slate-200 rounded-tl-none")}>
                {msg.type === 'text' ? (
                  <p>{msg.content}</p>
                ) : (
                  <audio controls src={msg.content} className="h-10 w-48" />
                )}
                <span className="text-[10px] opacity-50 mt-1 block text-right">
                  {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        {isRecording ? (
          <div className="flex-1 flex items-center gap-4 bg-red-500/10 text-red-500 px-4 py-3 rounded-xl">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
          </div>
        ) : (
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendText()}
            placeholder={language === 'ar' ? "اكتب رسالة..." : "Type a message..."}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        
        {newMessage.trim() ? (
          <button onClick={handleSendText} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors">
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={cn("p-3 rounded-xl transition-colors", isRecording ? "bg-red-500 text-white" : "bg-emerald-600 text-white hover:bg-emerald-500")}
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
