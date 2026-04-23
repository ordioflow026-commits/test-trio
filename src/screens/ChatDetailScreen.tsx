import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Mic, Paperclip, Camera, Send, Image as ImageIcon, FileText, File } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export default function ChatDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactProfileId, setContactProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Extract contact from navigation state
  const contact = location.state?.contact || { name: 'Test User US', phone: '+1 555 012 3456', initials: 'US' };

  // Sync scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch receiver ID and load messages
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    let channel: any = null;

    const initChat = async () => {
      // Find the contact's standard profile ID using their phone
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', contact.phone)
        .maybeSingle();

      const receiverId = profileData?.id || contact.phone; // fallback to phone if not registered
      if (isMounted) setContactProfileId(receiverId);

      // Fetch history
      const { data: history, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (isMounted) {
        if (!error && history) {
          setMessages(history);
        }
        setIsLoading(false);
      }

      // Start Realtime listener
      channel = supabase.channel(`chat_${user.id}_${receiverId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
        }, (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === user.id && newMsg.receiver_id === receiverId) ||
            (newMsg.sender_id === receiverId && newMsg.receiver_id === user.id)
          ) {
            setMessages(prev => {
              // Deduplicate based on ID since we also optimistically insert
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        })
        .subscribe();
    };

    initChat();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [contact.phone, user]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !contactProfileId) return;

    setShowAttachmentMenu(false);

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(`${user.id}/${fileName}`, file);

      if (error) {
        console.error("File upload error", error);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(`${user.id}/${fileName}`);
        
      const fileUrl = publicUrlData.publicUrl;

      // Send the file URL as a message
      const tempMsg: Message = {
        id: Date.now().toString(),
        sender_id: user.id,
        receiver_id: contactProfileId,
        content: `File: ${fileUrl}`,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, tempMsg]);

      const { error: insertError } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: contactProfileId,
        content: `File: ${fileUrl}`,
      });

      if (insertError) {
        console.error("Failed to send message", insertError);
        alert("Error: " + insertError.message);
      }

    } catch (err) {
      console.error("Upload process failed", err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !contactProfileId) return;
    const msgContent = messageText.trim();
    setMessageText('');
    const tempMsg: Message = {
      id: Date.now().toString(),
      sender_id: user.id,
      receiver_id: contactProfileId,
      content: msgContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: contactProfileId,
      content: msgContent,
    });
    if (error) {
      console.error("Failed to send message", error);
      alert("Error: " + error.message);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] font-sans relative overflow-hidden" dir={dir}>
      {/* Dynamic Background gradient matching the image */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3] opacity-80 pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between px-3 py-4 z-20">
        <div className="flex items-center gap-3 flex-1">
          <button 
            onClick={() => navigate(-1)} 
            className="p-1 -ml-1 text-white hover:text-slate-200 transition-colors"
          >
            <ArrowLeft strokeWidth={1.5} className="w-[22px] h-[22px]" />
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center text-white font-semibold text-sm shrink-0">
               {contact.initials || contact.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-[17px] leading-tight truncate max-w-[150px]">{contact.name}</span>
              <span className="text-[13px] text-slate-300 mt-0.5">{contact.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 text-white pr-2">
          <button 
            onClick={() => navigate('/call', { state: { title: contact.name, count: 1, type: 'video', targetId: contactProfileId }})}
            className="hover:text-slate-200 transition-colors"
          >
            <Video strokeWidth={1.5} className="w-[22px] h-[22px]" />
          </button>
          <button 
            onClick={() => navigate('/call', { state: { title: contact.name, count: 1, type: 'audio', targetId: contactProfileId }})}
            className="hover:text-slate-200 transition-colors"
          >
            <Phone strokeWidth={1.5} className="w-[22px] h-[22px]" />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto w-full relative z-10 px-4 flex flex-col gap-3 py-4">
         {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
         ) : (
            <>
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  Say hi to {contact.name}!
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${
                      isMe 
                        ? 'bg-[#00b4d8] text-white rounded-br-sm' 
                        : 'bg-slate-800/80 text-slate-100 rounded-bl-sm border border-slate-700/50'
                    }`}>
                      {msg.content.startsWith('File: ') ? (
                        <div className="flex flex-col gap-1 mt-1">
                          {msg.content.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                            <img src={msg.content.replace('File: ', '')} alt="Attachment" className="max-w-[200px] max-h-[200px] rounded-lg object-cover" />
                          ) : (
                            <a href={msg.content.replace('File: ', '')} target="_blank" rel="noopener noreferrer" className="text-white underline text-sm break-all">
                              Download Attachment
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-[15px] whitespace-pre-wrap leading-tight">{msg.content}</p>
                      )}
                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </>
         )}
      </main>

      {/* Attachment Menu (Overlay) */}
      {showAttachmentMenu && (
        <div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-4 z-40 animate-in slide-in-from-bottom-2 fade-in">
          <div className="grid grid-cols-3 gap-6 py-2 px-1">
            <button className="flex flex-col items-center gap-2 group" onClick={() => fileInputRef.current?.click()}>
               <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <ImageIcon className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">Gallery</span>
            </button>
            <button className="flex flex-col items-center gap-2 group" onClick={() => fileInputRef.current?.click()}>
               <div className="w-14 h-14 rounded-full bg-violet-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <FileText className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">Document</span>
            </button>
            <button className="flex flex-col items-center gap-2 group" onClick={() => fileInputRef.current?.click()}>
               <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <File className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">File</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </div>
        </div>
      )}

      {/* Background Dimmer when Attachment Menu is open */}
      {showAttachmentMenu && (
          <div 
            className="absolute inset-0 z-30" 
            onClick={() => setShowAttachmentMenu(false)}
          />
      )}

      {/* Footer / Input Bar */}
      <footer className="px-2 pb-3 flex items-end gap-2 z-40 w-full mb-safe">
        {/* Left Action Menu inside Pill */}
        <div className="flex-1 bg-[#009fb7] rounded-full flex items-center shadow-sm pl-4 pr-1 min-h-[48px]">
          <textarea 
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Message"
            className="flex-1 max-h-32 bg-transparent text-white placeholder-white/80 py-3 outline-none resize-none overflow-y-auto leading-tight"
            rows={1}
            dir={dir}
            onFocus={() => setShowAttachmentMenu(false)}
          />
          {/* Icons inside the pill as per image */}
          <div className="flex items-center gap-2 text-white shrink-0 ml-2">
            <button 
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            >
              <Paperclip strokeWidth={1.5} className="w-[22px] h-[22px]" />
            </button>
            <button className="p-2 hover:bg-white/20 rounded-full transition-colors mr-1">
              <Camera strokeWidth={1.5} className="w-[22px] h-[22px]" />
            </button>
          </div>
        </div>

        {/* Right Mic Button (vibrant cyan) */}
        <div className="shrink-0 mb-[1px]">
          {messageText.trim().length > 0 ? (
            <button 
              onClick={handleSendMessage}
              className="w-[48px] h-[48px] bg-[#00E5FF] rounded-full flex items-center justify-center text-[#0f172a] shadow-md hover:brightness-110 transition-colors"
            >
              <Send strokeWidth={2} className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button className="w-[48px] h-[48px] bg-[#00E5FF] rounded-full flex items-center justify-center text-[#0f172a] shadow-md hover:brightness-110 transition-colors">
              <Mic strokeWidth={2.5} className="w-5 h-5" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
