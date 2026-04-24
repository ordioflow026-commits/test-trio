import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Mic, Paperclip, Camera, Send, Image as ImageIcon, FileText, File, Check, CheckCheck, Copy, Trash2, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  status?: string;
  deleted_for?: string | null;
}

export default function ChatDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [contactProfileId, setContactProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
      const cleanPhone = contact.phone.replace(/\D/g, '').slice(-9);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .ilike('phone', `%${cleanPhone}%`)
        .maybeSingle();

      const receiverId = profileData?.id || null;
      if (isMounted) setContactProfileId(receiverId);

      // Fetch history
      const { data: history, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (isMounted) {
        if (!error && history) {
          setMessages(history.filter(m => m.deleted_for !== user.id));
        }
        setIsLoading(false);
      }

      // Start Realtime listener
      channel = supabase.channel(`chat_${user.id}_${receiverId}`)
        .on('postgres_changes', { 
            event: '*', // Listen to ALL events (INSERT, UPDATE, DELETE)
            schema: 'public', 
            table: 'messages',
        }, (payload) => {
          if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            return;
          }
          
          const newMsg = payload.new as Message;
          
          setMessages(prev => {
            // Handle UPDATE: Replace the existing message, do NOT duplicate
            if (payload.eventType === 'UPDATE') {
              if (newMsg.deleted_for === user.id) {
                 return prev.filter(m => m.id !== newMsg.id);
              }
              return prev.map(m => m.id === newMsg.id ? newMsg : m);
            }
            
            // Handle INSERT: Add only if it doesn't already exist
            if (payload.eventType === 'INSERT') {
              if (
                (newMsg.sender_id === user.id && newMsg.receiver_id === receiverId) ||
                (newMsg.sender_id === receiverId && newMsg.receiver_id === user.id)
              ) {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              }
            }
            
            return prev;
          });
        })
        .subscribe();
    };

    initChat();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [contact.phone, user]);

  // Mark incoming messages as read
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!user || !contactProfileId || messages.length === 0) return;
      if (document.visibilityState !== 'visible') return; // Prevent background marking
      
      // Find incoming messages that are not yet marked as read
      const unreadMessages = messages.filter(m => m.receiver_id === user.id && m.status !== 'read');
      
      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ status: 'read' })
          .eq('receiver_id', user.id)
          .eq('sender_id', contactProfileId)
          .neq('status', 'read');
      }
    };

    markMessagesAsRead();
    
    // Add event listener to mark as read when user switches back to the app/tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') markMessagesAsRead();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages, user, contactProfileId]);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user || !contactProfileId) return;

    const files = Array.from(fileList);
    e.target.value = ''; 
    setShowAttachmentMenu(false);

    // 1. Instant Local Preview (Fixing the extension bug)
    const tempMessages: Message[] = [];
    const tempUrls: string[] = [];

    files.forEach((file, index) => {
      const localUrl = URL.createObjectURL(file);
      tempUrls.push(localUrl);
      
      // FIX: Append a fake extension so the UI Regex detects it as an image and renders it instantly!
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? `${localUrl}#.jpg` : localUrl;

      tempMessages.push({
        id: `temp_${Date.now()}_${index}`,
        sender_id: user.id,
        receiver_id: contactProfileId,
        content: `File: ${previewUrl}`,
        created_at: new Date().toISOString(),
        status: 'sending'
      });
    });

    // Show images instantly in the UI
    setMessages(prev => [...prev, ...tempMessages]);
    setUploadingCount(prev => prev + files.length);

    // 2. Parallel Uploads (Much Faster than sequential for loop)
    const uploadPromises = files.map(async (originalFile, i) => {
      const tempId = tempMessages[i].id;
      // Clean file name to prevent URL errors
      const safeName = originalFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(`${user.id}/${fileName}`, originalFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(`${user.id}/${fileName}`);
          
        const { data: insertedFileMsg, error: insertError } = await supabase.from('messages').insert({
          sender_id: user.id,
          receiver_id: contactProfileId,
          content: `File: ${publicUrlData.publicUrl}`,
          status: 'sent'
        }).select().single();

        if (insertError) throw insertError;

        if (insertedFileMsg) {
          setMessages(prev => prev.map(m => m.id === tempId ? insertedFileMsg : m));
        }
      } catch (err) {
        console.error("Upload failed", err);
        setMessages(prev => prev.filter(m => m.id !== tempId));
      } finally {
        setUploadingCount(prev => Math.max(0, prev - 1));
      }
    });

    // Execute all uploads simultaneously
    await Promise.all(uploadPromises);

    setTimeout(() => {
      tempUrls.forEach(url => URL.revokeObjectURL(url));
    }, 15000);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !contactProfileId) return;
    
    const msgContent = messageText.trim();
    setMessageText('');

    const { data: insertedMsg, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: contactProfileId,
      content: msgContent,
      status: 'sent'
    }).select().single();

    if (error) {
      console.error("Failed to send message", error);
      alert("Error: " + error.message);
    } else if (insertedMsg) {
      setMessages(prev => {
        if (prev.find(m => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg];
      });
    }
  };

  const handleCopy = async () => {
    if (!selectedMessage) return;
    
    try {
      await navigator.clipboard.writeText(selectedMessage.content);
      // Close the modal
      setSelectedMessage(null);
      // Show a quick success alert/toast
      alert("تم نسخ الرسالة بنجاح! ✔️");
    } catch (err) {
      console.error("Failed to copy!", err);
      alert("حدث خطأ أثناء النسخ.");
    }
  };

  const handleDeleteForMe = async () => {
    if (!selectedMessage || !user) return;
    
    // Optimistic UI update
    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
    
    if (selectedMessage.deleted_for) {
       // If the other person already deleted it for themselves, just remove the row permanently
       await supabase.from('messages').delete().eq('id', selectedMessage.id);
    } else {
       // Otherwise, mark it as deleted for the current user only
       await supabase.from('messages').update({ deleted_for: user.id }).eq('id', selectedMessage.id);
    }
    setSelectedMessage(null);
  };

  const handleDeleteForEveryone = async () => {
    if (!selectedMessage) return;
    const confirmDelete = window.confirm("هل أنت متأكد أنك تريد حذف هذه الرسالة لدى الجميع؟");
    if (!confirmDelete) return;

    // Optimistic removal
    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
    // Permanent deletion from database
    await supabase.from('messages').delete().eq('id', selectedMessage.id);
    setSelectedMessage(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setUploadingCount(prev => prev + 1);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const fileName = `audio_${Date.now()}.webm`;
        
        try {
          const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(`${user!.id}/${fileName}`, audioBlob);

          if (uploadError) {
            console.error("Audio upload error", uploadError);
            alert("فشل رفع المقطع الصوتي");
            return;
          }

          const { data: publicUrlData } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(`${user!.id}/${fileName}`);
            
          const fileUrl = publicUrlData.publicUrl;

          const { data: insertedMsg, error: insertError } = await supabase.from('messages').insert({
            sender_id: user!.id,
            receiver_id: contactProfileId,
            content: `Audio: ${fileUrl}`,
            status: 'sent'
          }).select().single();

          if (insertError) {
            console.error("Failed to send audio message", insertError);
          } else if (insertedMsg) {
            setMessages(prev => {
              if (prev.find(m => m.id === insertedMsg.id)) return prev;
              return [...prev, insertedMsg];
            });
          }
        } catch (err) {
          console.error("Audio upload process failed", err);
        } finally {
          setUploadingCount(prev => Math.max(0, prev - 1));
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      const isArabic = dir === 'rtl';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        if (isArabic) {
          alert("عذراً! لا يمكننا الوصول إلى الميكروفون. 🎙️\n\nلحل المشكلة بسهولة، اتبع هذه الخطوات:\n\n1- اضغط على (الثلاث نقاط ⋮) في أعلى المتصفح، ثم اختر (الإعدادات).\n2- انزل للأسفل واضغط على (إعدادات المواقع الإلكترونية).\n3- ابحث عن (الميكروفون) واضغط عليه.\n4- قم بتغيير الصلاحية إلى (السماح).\n\nأو ببساطة: اضغط على الرمز الموجود بجانب رابط الموقع بالأعلى وعدّل الصلاحية مباشرة.");
        } else {
          alert("Sorry! We cannot access the microphone. 🎙️\n\nTo easily fix this, follow these steps:\n\n1- Click the (three dots ⋮) at the top of your browser, then choose (Settings).\n2- Scroll down and click on (Site Settings).\n3- Find (Microphone) and click on it.\n4- Change the permission to (Allow).\n\nOr simply: click the icon next to the website URL at the top and change the permission directly.");
        }
      } else {
        alert(isArabic ? "حدث خطأ أثناء محاولة تشغيل الميكروفون. تأكد من أن جهازك يدعم تسجيل الصوت." : "An error occurred while trying to access the microphone. Make sure your device supports audio recording.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
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
                    <div 
                      onClick={() => setSelectedMessage(msg)}
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm cursor-pointer transition-transform active:scale-[0.98] ${
                      isMe 
                        ? 'bg-[#00b4d8] text-white rounded-br-sm' 
                        : 'bg-slate-800/80 text-slate-100 rounded-bl-sm border border-slate-700/50'
                    }`}>
                      {msg.content.startsWith('Audio: ') ? (
                        <div className="mt-1">
                          <audio controls src={msg.content.replace('Audio: ', '')} className="max-w-[220px] h-10" />
                        </div>
                      ) : msg.content.startsWith('File: ') ? (
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
                      <div className="flex items-center justify-end gap-1 mt-1 pb-0.5">
                        <p className={`text-[10px] ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {msg.status === 'read' && (
                          <div className="flex items-center">
                            <Check strokeWidth={3} className="w-[14px] h-[14px] text-[#00E5FF]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {uploadingCount > 0 && (
                <div className="flex justify-end mb-2">
                  <div className="max-w-[75%] px-4 py-3 rounded-2xl bg-[#00b4d8] text-white rounded-br-sm shadow-sm flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">جاري إرسال {uploadingCount > 1 ? `${uploadingCount} ملفات` : 'الملف'}...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-1" />
            </>
         )}
      </main>

      {/* Message Actions Modal */}
      {selectedMessage && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedMessage(null)}
          />
          <div className="bg-slate-800 rounded-2xl shadow-2xl z-10 w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200 border border-slate-700">
            <div className="flex flex-col">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-3 px-6 py-4 text-white hover:bg-slate-700/50 transition-colors"
              >
                <Copy className="w-5 h-5 text-blue-400" />
                <span className="font-medium">نسخ الرسالة</span>
              </button>
              
              <button 
                onClick={handleDeleteForMe}
                className="flex items-center gap-3 px-6 py-4 text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-medium">حذف لدي فقط</span>
              </button>
              
              {selectedMessage.sender_id === user?.id && (
                <button 
                  onClick={handleDeleteForEveryone}
                  className="flex items-center gap-3 px-6 py-4 text-red-400 hover:bg-red-500/10 transition-colors border-t border-slate-700/50"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="font-medium">حذف لدى الجميع</span>
                </button>
              )}

              <button 
                onClick={() => setSelectedMessage(null)}
                className="flex items-center justify-center px-6 py-4 text-slate-400 hover:bg-slate-700/50 transition-colors border-t border-slate-700/50"
              >
                <span className="font-medium">إلغاء</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Menu (Overlay) */}
      {showAttachmentMenu && (
        <div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-4 z-40 animate-in slide-in-from-bottom-2 fade-in">
          <div className="grid grid-cols-3 gap-6 py-2 px-1">
            <button className="flex flex-col items-center gap-2 group" onClick={() => galleryInputRef.current?.click()}>
               <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <ImageIcon className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">Gallery</span>
            </button>
            <button className="flex flex-col items-center gap-2 group" onClick={() => cameraInputRef.current?.click()}>
               <div className="w-14 h-14 rounded-full bg-violet-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <Camera className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">Camera</span>
            </button>
            <button className="flex flex-col items-center gap-2 group" onClick={() => fileInputRef.current?.click()}>
               <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <File className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">File</span>
            </button>
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

      {/* Hidden File Inputs (Must be outside conditional blocks to work with external buttons) */}
      <input type="file" accept="image/*,video/*" multiple ref={galleryInputRef} className="hidden" onChange={handleFileUpload} />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileUpload} />
      <input type="file" accept="*/*" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

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
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="p-2 hover:bg-white/20 rounded-full transition-colors mr-1"
            >
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
            isRecording ? (
              <button 
                onClick={stopRecording}
                className="w-[48px] h-[48px] bg-red-500 animate-pulse rounded-full flex items-center justify-center text-white shadow-md hover:brightness-110 transition-colors"
              >
                <Mic strokeWidth={2.5} className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={startRecording}
                className="w-[48px] h-[48px] bg-[#00E5FF] rounded-full flex items-center justify-center text-[#0f172a] shadow-md hover:brightness-110 transition-colors"
              >
                <Mic strokeWidth={2.5} className="w-5 h-5" />
              </button>
            )
          )}
        </div>
      </footer>
    </div>
  );
}
