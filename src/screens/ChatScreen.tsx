import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, Video, Paperclip, Camera, Mic, Send, ArrowLeft, XCircle, WifiOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { Capacitor } from '@capacitor/core';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function ChatScreen() {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const contact = location.state?.contact;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Network Resilience Effect
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (showCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Camera access error:", err);
          alert("Camera access denied or unavailable.");
          setShowCamera(false);
        });
    }

    return () => {
      // Cleanup camera stream
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  useEffect(() => {
    if (!contact) {
      navigate('/main');
      return;
    }

    if (!user) return;

    const fetchMessages = async () => {
      // Fetch bidirectional messages
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact.phone}),and(sender_id.eq.${contact.phone},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error("Error fetching messages:", error);
      } else if (data) {
        // Map messages so we know who is who based on our number (even if dummy)
        const mappedData = data.map(m => ({
          ...m,
          is_sent_by_me: m.sender_id === user.id
        }));
        setMessages(mappedData);
        scrollToBottom();
      }
    };

    fetchMessages();

    // Subscribe to realtime changes
    const channel = supabase.channel('chat-room')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
      }, (payload) => {
        const newMsg = payload.new;
        // Check if message belongs to this conversation
        const isFromMe = newMsg.sender_id === user.id && newMsg.receiver_id === contact.phone;
        const isToMe = newMsg.sender_id === contact.phone && newMsg.receiver_id === user.id;
        
        if (isFromMe || isToMe) {
          setMessages(prev => {
            // Avoid duplicates via local optimistic updates
            if (prev.find(m => m.id === newMsg.id || (m.content === newMsg.content && m.status === 'sending'))) {
               return prev.map(m => m.content === newMsg.content && m.status === 'sending' ? { ...newMsg, is_sent_by_me: isFromMe } : m);
            }
            return [...prev, { ...newMsg, is_sent_by_me: isFromMe }];
          });
          scrollToBottom();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, contact, navigate]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        sendMessage(dataUrl, 'image');
        setShowCamera(false);
      }
    }
  };

  const sendMessage = async (content: string, type: 'text' | 'audio' | 'image' | 'video' = 'text', existingId?: string) => {
    if (!content.trim() && type === 'text') return;
    if (!user || !contact) return;

    const msgId = existingId || Date.now().toString();

    // Optimistic UI update
    if (!existingId) {
      const tempMsg = {
        id: msgId,
        sender_id: user.id,
        receiver_id: contact.phone,
        content,
        type,
        created_at: new Date().toISOString(),
        is_sent_by_me: true,
        status: 'sending'
      };
      setMessages(prev => [...prev, tempMsg]);
      setInputText('');
      scrollToBottom();
    } else {
       setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sending' } : m));
    }

    try {
      // Insert into Supabase
      const { error } = await supabase.from('chat_messages').insert([{
        sender_id: user.id,
        receiver_id: contact.phone,
        content,
        type,
      }]);

      if (error) throw error;
      
      // Update status to sent locally if channel hasn't broadcasted it yet
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));

      // AI Logic: Check if we are talking to Gemini AI Assistant
      if (contact.phone === '+AI_AGENT_00' && type === 'text') {
         try {
           const response = await ai.models.generateContent({
             model: "gemini-3-flash-preview",
             contents: content,
           });
           
           if (response.text) {
             await supabase.from('chat_messages').insert([{
               sender_id: contact.phone,
               receiver_id: user.id,
               content: response.text,
               type: 'text',
             }]);
           }
         } catch(aiErr) {
           console.error("AI Error:", aiErr);
           await supabase.from('chat_messages').insert([{
             sender_id: contact.phone,
             receiver_id: user.id,
             content: "Sorry, I am offline right now or my API key is invalid.",
             type: 'text',
           }]);
         }
      }

    } catch (err) {
      console.error("Failed to save message:", err);
      // Mark as failed
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'failed' } : m));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        // We use Base64 reading so that it actually saves into the database as a string and works continuously after app restarts. 
        // Using temporary URL.createObjectURL(blob) would break after a refresh since the url gets destroyed.
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          sendMessage(base64Audio, 'audio');
        };
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err: any) {
      alert("Microphone access is required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' = 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      sendMessage(base64Data, type);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const startVideoCall = () => {
    const rId = [user?.id || '', contact.phone].sort().join('-');
    navigate('/call', { 
      state: { 
        title: 'Video Call', 
        isVideo: true, 
        isGroup: false, 
        participants: [contact.phone], 
        roomId: `call_${rId}`,
        contactName: contact.name,
        initials: contact.initials
      } 
    });
  };

  const startVoiceCall = () => {
    const rId = [user?.id || '', contact.phone].sort().join('-');
    navigate('/call', { 
      state: { 
        title: 'Voice Call', 
        isVideo: false, 
        isGroup: false, 
        participants: [contact.phone], 
        roomId: `call_${rId}`,
        contactName: contact.name,
        initials: contact.initials
      } 
    });
  };

  if (!contact) return null;

  return (
    <div className="flex flex-col h-full absolute inset-0 bg-[#0b141a]">
      {/* WhatsApp Chat Background Pattern */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none z-0" 
        style={{
          backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
          backgroundSize: '400px'
        }}
      />

      {/* Header */}
      <div className="bg-[#202c33] flex items-center px-4 py-3 z-10 shadow-md">
        <button onClick={() => navigate(-1)} className="mr-2 text-slate-300 hover:text-white transition-colors active:scale-90">
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-sm mr-3">
          {contact.initials}
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-semibold text-lg truncate leading-tight">{contact.name}</h2>
            {!isOnline && (
               <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                 <WifiOff className="w-3 h-3" /> Offline
               </span>
            )}
            {isOnline && contact.phone === '+AI_AGENT_00' && (
               <span className="text-xs text-[#00a884] bg-[#00a884]/10 px-2 py-0.5 rounded-full border border-[#00a884]/30">AI Active</span>
            )}
          </div>
          <p className="text-slate-400 text-xs truncate" dir="ltr">{contact.phone}</p>
        </div>

        <div className="flex items-center gap-5 ml-2">
          <button 
            onClick={startVideoCall} 
            className="text-slate-300 hover:text-white transition-colors active:scale-90"
          >
            <Video className="w-6 h-6" />
          </button>
          <button 
            onClick={startVoiceCall} 
            className="text-slate-300 hover:text-white transition-colors active:scale-90"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 z-10 flex flex-col gap-2">
        {messages.map((msg) => {
          // Assuming sender_id matches local user means it was sent by us. 
          const isSentByMe = msg.sender_id === user?.id || msg.is_sent_by_me;
          
          return (
            <div key={msg.id} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} mb-1`}>
              <div 
                className={`max-w-[80%] rounded-lg px-3 py-2 shadow-sm relative ${
                  isSentByMe ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Content based on type */}
                {msg.type === 'text' && (
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
                
                {msg.type === 'audio' && (
                  <audio controls src={msg.content} className="max-w-full h-10" />
                )}

                {(msg.type === 'image' || msg.type === 'video') && (
                  <img src={msg.content} alt="Attachment" className="max-w-full rounded-md mt-1 mb-1" />
                )}

                <span className="text-[10px] text-slate-400 float-right mt-1 ml-3 align-bottom">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              {/* Retry Button side of the bubble */}
              {msg.status === 'failed' && isSentByMe && (
                <button 
                  onClick={() => sendMessage(msg.content, msg.type, msg.id)}
                  className="ml-2 self-center rounded-full bg-red-500/20 p-2 text-red-500 hover:bg-red-500/30 transition-colors"
                  title="Retry sending"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Bar: Input & Actions */}
      <div className="bg-[#202c33] px-3 py-3 flex items-end gap-2 z-10 min-h-[60px]">
        {/* Hidden inputs for file/camera */}
        <input type="file" accept="image/*,video/*,audio/*,application/pdf" className="hidden" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'image')} />

        <div className="flex-1 bg-[#2a3942] rounded-3xl flex items-end px-2 py-2 shadow-sm border border-slate-700/50">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message"
            className="flex-1 bg-transparent text-white border-none outline-none resize-none max-h-32 min-h-[24px] px-3 py-1 self-center text-[15px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputText, 'text');
              }
            }}
            style={{ height: 'auto', overflowY: 'auto' }}
          />
          
          <div className="flex items-center gap-3 text-slate-400 px-2 pb-1">
            <button onClick={() => fileInputRef.current?.click()} className="hover:text-white transition-colors active:scale-90">
              <Paperclip className="w-5 h-5 -rotate-45" />
            </button>
            <button onClick={() => setShowCamera(true)} className="hover:text-white transition-colors active:scale-90">
              <Camera className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center pb-1">
          {inputText.trim().length > 0 ? (
            <button 
              onClick={() => sendMessage(inputText, 'text')}
              className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button 
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all select-none touch-none ${
                isRecording ? 'bg-red-500 scale-125' : 'bg-[#00a884] hover:scale-105 active:scale-95'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen Camera Capture Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
             <button onClick={() => setShowCamera(false)} className="text-white p-2">
               <ArrowLeft className="w-8 h-8" />
             </button>
          </div>
          
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="flex-1 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center items-center z-10 bg-gradient-to-t from-black/80 to-transparent">
             <button 
               onClick={capturePhoto} 
               className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:bg-white flex items-center justify-center transition-all"
             >
                <div className="w-16 h-16 rounded-full bg-transparent border-2 border-transparent" />
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
