import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Mic, Paperclip, Camera, Send, Image as ImageIcon, FileText, File, Check, CheckCheck, Copy, Trash2, X, Square, ArrowDown, CornerUpLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { useZego } from '../contexts/ZegoContext';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { supabase } from '../lib/supabase';

const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
  const { zp } = useZego();
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [contactProfileId, setContactProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [inputKey, setInputKey] = useState(Date.now());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contact = location.state?.contact || { name: 'Chat', phone: '', initials: '?' };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let channel: any = null;

    const initChat = async () => {
      try {
        const cleanPhone = contact.phone.replace(/\D/g, '').slice(-9);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .ilike('phone', `%${cleanPhone}%`)
          .maybeSingle();

        const receiverId = profileData?.id || null;
        if (isMounted) setContactProfileId(receiverId);

        if (receiverId) {
          const { data: history } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

          if (isMounted && history) {
            setMessages(history.filter(m => m.deleted_for !== user.id));
          }

          channel = supabase.channel(`chat_${user.id}_${receiverId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
              if (payload.eventType === 'DELETE') {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
              } else {
                const newMsg = payload.new as Message;
                setMessages(prev => {
                  if (payload.eventType === 'UPDATE') {
                    if (newMsg.deleted_for === user.id) return prev.filter(m => m.id !== newMsg.id);
                    return prev.map(m => m.id === newMsg.id ? newMsg : m);
                  }
                  return prev.find(m => m.id === newMsg.id) ? prev.map(m => m.id === newMsg.id ? newMsg : m) : [...prev, newMsg];
                });
              }
            })
            .subscribe();
        }
      } catch (err) {
        console.error("Chat init error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initChat();
    return () => { isMounted = false; if (channel) supabase.removeChannel(channel); };
  }, [contact.phone, user]);

  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!user || !contactProfileId || messages.length === 0) return;
      if (document.visibilityState !== 'visible') return; 
      
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
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') markMessagesAsRead(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages, user, contactProfileId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 150);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'اليوم';
    if (date.toDateString() === yesterday.toDateString()) return 'أمس';

    return date.toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // 💡 التحديث الجديد: إرسال سجل للمكالمة داخل المحادثة بشكل آمن
  const logCallInChat = async (isVideo: boolean) => {
    if (!user || !contactProfileId) return;
    const content = isVideo ? '📹 مكالمة فيديو' : '📞 مكالمة صوتية';
    
    const tempId = generateUUID();
    const tempMsg: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: contactProfileId,
      content,
      created_at: new Date().toISOString(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(scrollToBottom, 50);

    const { error } = await supabase.from('messages').insert({ 
      id: tempId, 
      sender_id: user.id, 
      receiver_id: contactProfileId, 
      content, 
      status: 'sent' 
    });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error("Failed to log call", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user || !contactProfileId) return;
    const files = Array.from(fileList) as File[];
    setShowAttachmentMenu(false);
    setUploadingCount(prev => prev + files.length);
    
    const uploadPromises = files.map(async (file) => {
      const fileName = `${Date.now()}_${generateUUID()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      try {
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
        await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content: `File: ${publicUrlData.publicUrl}`, status: 'sent' });
      } catch (err) { 
        console.error(err); 
      }
    });

    await Promise.all(uploadPromises);
    setUploadingCount(prev => Math.max(0, prev - files.length));
    setInputKey(Date.now());
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !contactProfileId) return;
    
    let content = messageText.trim();
    if (replyToMsg) {
      const senderName = replyToMsg.sender_id === user.id ? (t('you') || 'أنت') : contact.name;
      content = `[REPLY|${senderName}|${replyToMsg.content}] ${content}`;
      setReplyToMsg(null);
    }
    
    setMessageText('');
    
    const tempId = generateUUID();
    const tempMsg: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: contactProfileId,
      content,
      created_at: new Date().toISOString(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(scrollToBottom, 50);

    const { error } = await supabase.from('messages').insert({ 
      id: tempId, 
      sender_id: user.id, 
      receiver_id: contactProfileId, 
      content, 
      status: 'sent' 
    });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error("Failed to send", error);
    }
  };

  const handleCopyMultiple = async () => {
    const textsToCopy = messages
      .filter(m => selectedMessageIds.includes(m.id))
      .map(m => {
        if (m.content.startsWith('Audio: ')) return '[رسالة صوتية]';
        if (m.content.startsWith('File: ')) return '[ملف مرفق]';
        return m.content;
      })
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(textsToCopy);
      setSelectedMessageIds([]); 
    } catch (err) { console.error("Copy failed", err); }
  };

  const handleDeleteForMeMultiple = async () => {
    const idsToDelete = [...selectedMessageIds];
    setSelectedMessageIds([]);
    setShowDeleteOptions(false);
    
    setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
    for (const id of idsToDelete) {
      await supabase.from('messages').update({ deleted_for: user?.id }).eq('id', id);
    }
  };

  const handleDeleteForEveryoneMultiple = async () => {
    const idsToDelete = [...selectedMessageIds];
    setShowDeleteOptions(false);
    
    setTimeout(async () => {
      const confirmDelete = window.confirm("هل أنت متأكد أنك تريد حذف الرسائل المحددة لدى الجميع؟");
      if (!confirmDelete) return;

      setSelectedMessageIds([]);
      setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
      
      for (const id of idsToDelete) {
        await supabase.from('messages').delete().eq('id', id);
      }
    }, 50);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          return;
        }
        setRecordedAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const cancelRecording = () => {
    setRecordedAudioBlob(null);
    if (mediaRecorderRef.current && isRecording) {
      cancelRecordingRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const sendRecordedAudio = async () => {
    if (!recordedAudioBlob || !user || !contactProfileId) return;
    setUploadingCount(prev => prev + 1);
    const fileName = `audio_${Date.now()}.webm`;
    try {
      await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, recordedAudioBlob);
      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
      await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content: `Audio: ${data.publicUrl}`, status: 'sent' });
      setRecordedAudioBlob(null);
    } catch (err) { console.error(err); }
    finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
  };

  let lastDateString = '';

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] font-sans relative overflow-hidden" dir={dir}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3] opacity-80 pointer-events-none" />
      
      {selectedMessageIds.length > 0 ? (
        <header className="flex items-center justify-between px-4 py-4 z-30 bg-[#0f283d] text-white shadow-md border-b border-white/10 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedMessageIds([])} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>
            <span className="font-semibold text-[18px]">{selectedMessageIds.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedMessageIds.length === 1 && (
              <button 
                onClick={() => {
                  const targetMsg = messages.find(m => m.id === selectedMessageIds[0]);
                  if (targetMsg) setReplyToMsg(targetMsg);
                  setSelectedMessageIds([]);
                }} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <CornerUpLeft className="w-6 h-6 text-white" />
              </button>
            )}
            <button onClick={handleCopyMultiple} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Copy className="w-6 h-6 text-white" />
            </button>
            <button onClick={() => setShowDeleteOptions(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Trash2 className="w-6 h-6 text-white" />
            </button>
          </div>
        </header>
      ) : (
        <header className="flex items-center justify-between px-3 py-4 z-20 text-white transition-all">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="w-[22px] h-[22px]" /></button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center font-semibold shrink-0">{contact.initials}</div>
              <div className="flex flex-col">
                <span className="font-semibold text-[17px] leading-tight truncate max-w-[150px]">{contact.name}</span>
                <span className="text-[13px] text-slate-300 mt-0.5">{contact.phone}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pr-2">
            <button 
              onClick={() => {
                if (!zp || !contactProfileId) return;
                const targetZegoId = contactProfileId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
                zp.sendCallInvitation({
                  callees: [{ userID: targetZegoId, userName: contact.name }],
                  callType: 1, // Video
                  timeout: 60
                }).catch(console.error);
                logCallInChat(true); // 💡 تسجيل المكالمة
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Video strokeWidth={1.5} className="w-[22px] h-[22px] text-white" />
            </button>
            <button 
              onClick={() => {
                if (!zp || !contactProfileId) return;
                const targetZegoId = contactProfileId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
                zp.sendCallInvitation({
                  callees: [{ userID: targetZegoId, userName: contact.name }],
                  callType: 0, // Audio
                  timeout: 60
                }).catch(console.error);
                logCallInChat(false); // 💡 تسجيل المكالمة
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Phone strokeWidth={1.5} className="w-[20px] h-[20px] text-white" />
            </button>
          </div>
        </header>
      )}

      <main 
        ref={mainScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto w-full relative z-10 px-4 flex flex-col gap-2 py-4 scroll-smooth"
      >
         {isLoading ? (
            <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
         ) : !contactProfileId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
               <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mb-4 border border-slate-700/50"><X className="w-8 h-8 text-red-400" /></div>
               <p className="text-slate-200 font-medium text-lg">جهة الاتصال غير مسجلة</p>
            </div>
         ) : (
            <>
              {messages.length === 0 && <div className="text-center text-slate-400 mt-10">Say hi to {contact.name}!</div>}
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                const isSelected = selectedMessageIds.includes(msg.id);
                
                const msgDateString = new Date(msg.created_at).toDateString();
                const showDateSeparator = msgDateString !== lastDateString;
                lastDateString = msgDateString;
                
                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-4 animate-in fade-in duration-500">
                        <span className="px-4 py-1 bg-slate-800/60 text-slate-200 text-[11px] font-medium rounded-full shadow-sm backdrop-blur-md border border-slate-700/50">
                          {formatDateSeparator(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div 
                      className={`flex items-center w-full py-1.5 px-2 rounded-xl transition-colors animate-in fade-in duration-300 ${isSelected ? 'bg-blue-500/20' : ''}`}
                      onClick={() => {
                        if (selectedMessageIds.length > 0) {
                          setSelectedMessageIds(prev => prev.includes(msg.id) ? prev.filter(id => id !== msg.id) : [...prev, msg.id]);
                        }
                      }}
                    >
                      {selectedMessageIds.length > 0 && (
                        <div className="mx-2 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                             style={{ borderColor: isSelected ? '#3b82f6' : 'rgba(255,255,255,0.4)', backgroundColor: isSelected ? '#3b82f6' : 'transparent' }}>
                          {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        </div>
                      )}

                      <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div 
                          onContextMenu={(e) => { 
                            e.preventDefault(); 
                            if (!selectedMessageIds.includes(msg.id)) {
                              setSelectedMessageIds(prev => [...prev, msg.id]);
                            }
                          }}
                          className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm text-white select-none relative ${isMe ? 'bg-[#00b4d8] rounded-br-none' : 'bg-slate-800/80 rounded-bl-none border border-slate-700/50'}`}
                        >
                          {selectedMessageIds.length > 0 && <div className="absolute inset-0 z-10 cursor-pointer rounded-2xl" />}
                          
                          {(() => {
                            const replyMatch = msg.content.match(/^\[REPLY\|(.*?)\|(.*?)\] ([\s\S]*)$/);
                            if (replyMatch) {
                              const [_, quoteSender, quoteContent, actualContent] = replyMatch;
                              
                              let displayQuote = quoteContent;
                              if (quoteContent.startsWith('Audio: ')) displayQuote = '🎵 Audio';
                              else if (quoteContent.startsWith('File: ')) displayQuote = '📎 Attachment';
                              
                              return (
                                <div className="flex flex-col gap-1.5 w-full">
                                  <div className="w-full bg-black/20 rounded-xl px-3 py-2 border-l-4 border-[#00E5FF] mb-1">
                                    <span className="text-[#00E5FF] text-[12px] font-bold block mb-0.5">{quoteSender}</span>
                                    <p className="text-[13px] text-white/80 line-clamp-2 truncate">{displayQuote}</p>
                                  </div>
                                  <p className="text-[15px]">{actualContent}</p>
                                </div>
                              );
                            }
                            
                            if (msg.content.startsWith('Audio: ')) {
                              return (
                                <div dir="ltr" style={{ minWidth: '200px', width: '100%', maxWidth: '240px' }}>
                                  <audio controls preload="metadata" src={msg.content.replace('Audio: ', '')} style={{ display: 'block', width: '100%', minWidth: '200px', height: '54px', minHeight: '54px', flexShrink: 0 }} className="outline-none rounded-full bg-slate-100/10" />
                                </div>
                              );
                            } else if (msg.content.startsWith('File: ')) {
                              return (
                                <div className="flex flex-col gap-1 mt-1">
                                  {msg.content.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) || msg.content.includes('#.jpg') ? (
                                    <img src={msg.content.replace('File: ', '')} className="max-w-[200px] rounded-lg cursor-pointer" alt="attachment" onClick={() => setFullScreenImage(msg.content.replace('File: ', ''))} />
                                  ) : (
                                    <a href={msg.content.replace('File: ', '')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/20 rounded-xl hover:bg-black/30 transition-colors mt-1 relative z-20">
                                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5 text-white" />
                                      </div>
                                      <span className="text-sm font-medium text-white underline-offset-4 underline truncate max-w-[150px]">
                                        عرض الملف المرفق
                                      </span>
                                    </a>
                                  )}
                                </div>
                              );
                            } else {
                              return <p className="text-[15px]">{msg.content}</p>;
                            }
                          })()}
                          
                          <div className="flex items-center justify-end gap-1 mt-1 relative z-0">
                            <span className="text-[10px] opacity-70">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {/* إظهار علامة صح واحدة فقط لكلا الطرفين عند القراءة، وعدم إظهار شيء قبل ذلك */}
                            {msg.status === 'read' ? <Check strokeWidth={3} className="w-[14px] h-[14px] text-[#00E5FF]" /> : <Check strokeWidth={3} className="w-[14px] h-[14px] text-white/70" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              {uploadingCount > 0 && (
                <div className="flex justify-end mb-2">
                  <div className="max-w-[75%] px-4 py-3 rounded-2xl bg-[#00b4d8] text-white rounded-br-sm shadow-sm flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">جاري الإرسال...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </>
         )}
      </main>

      {/* Floating Scroll to Bottom Button */}
      {showScrollButton && (
        <button 
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 z-30 p-3 bg-[#0f283d] text-white rounded-full shadow-2xl border border-white/10 hover:bg-[#1a3a54] transition-all animate-in zoom-in duration-200"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      {showDeleteOptions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteOptions(false)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-xs overflow-hidden border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button onClick={handleDeleteForMeMultiple} className="w-full p-5 text-start text-red-400 flex items-center gap-3 hover:bg-slate-700 transition-colors">
              <Trash2 className="w-5 h-5" /> <span className="font-medium">حذف لدي</span>
            </button>
            
            {selectedMessageIds.every(id => messages.find(m => m.id === id)?.sender_id === user?.id) && (
              <button onClick={handleDeleteForEveryoneMultiple} className="w-full p-5 text-start text-red-500 flex items-center gap-3 border-t border-slate-700 hover:bg-slate-700 transition-colors">
                <Trash2 className="w-5 h-5" /> <span className="font-medium">حذف لدى الجميع</span>
              </button>
            )}
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center p-4 bg-black/50 absolute top-0 left-0 right-0 z-10">
            <button onClick={() => setFullScreenImage(null)} className="text-white p-2 hover:bg-white/20 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
            <img src={fullScreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}

      <footer className={`px-2 pb-3 mb-safe z-40 w-full relative ${(!contactProfileId && !isLoading) || selectedMessageIds.length > 0 ? 'opacity-40 pointer-events-none' : ''}`}>
        
        {replyToMsg && (
          <div className="px-3 pb-2 mx-2 mb-2">
            <div className="bg-slate-800/90 backdrop-blur-sm p-3 rounded-2xl flex items-center justify-between border-l-4 border-[#00E5FF] shadow-lg">
              <div className="flex flex-col mr-2 w-full">
                <span className="text-[#00E5FF] text-[13px] font-bold">
                  {replyToMsg.sender_id === user?.id ? (t('you') || 'أنت') : contact.name}
                </span>
                <span className="text-white/80 text-[14px] line-clamp-1">
                  {replyToMsg.content.startsWith('Audio: ') ? '🎵 Audio' : 
                   replyToMsg.content.startsWith('File: ') ? '📎 Attachment' : 
                   replyToMsg.content.replace(/^\[REPLY\|(.*?)\|(.*?)\] /, '')}
                </span>
              </div>
              <button 
                onClick={() => setReplyToMsg(null)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </div>
        )}

        {recordedAudioBlob ? (
          <div className="flex items-center gap-2 bg-[#009fb7] p-1 pl-2 rounded-[28px] shadow-sm">
            <button onClick={cancelRecording} className="p-3 bg-red-400 text-white rounded-full hover:bg-red-500 transition-colors shadow-sm"><Trash2 className="w-5 h-5" /></button>
            <div className="flex-1 flex items-center justify-center px-1" dir="ltr" style={{ minWidth: 0 }}>
              <audio src={URL.createObjectURL(recordedAudioBlob)} controls preload="metadata" style={{ display: 'block', width: '100%', minWidth: '200px', maxWidth: '240px', height: '50px', minHeight: '50px', flexShrink: 0 }} className="outline-none" />
            </div>
            <button onClick={sendRecordedAudio} className="w-[48px] h-[48px] bg-white rounded-full flex items-center justify-center text-[#009fb7] shadow-md hover:brightness-95 transition-colors shrink-0"><Send className="w-5 h-5 ml-1" /></button>
          </div>
        ) : isRecording ? (
          <div className="flex items-center gap-2 bg-[#009fb7] p-1 pl-2 rounded-[28px] shadow-sm">
            <button onClick={cancelRecording} className="p-3 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"><X className="w-5 h-5" /></button>
            <div className="flex-1 flex items-center justify-center gap-3 bg-white/10 rounded-full h-[48px]">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-white font-medium tracking-wide">جاري التسجيل...</span>
            </div>
            <button onClick={stopRecording} className="w-[48px] h-[48px] bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors animate-pulse shrink-0"><Square className="w-5 h-5 fill-current" /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-[#009fb7] rounded-[28px] flex items-center shadow-sm pl-4 pr-1 min-h-[48px]">
              <textarea 
                value={messageText} 
                onChange={e => setMessageText(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Message" 
                className="flex-1 bg-transparent text-white outline-none py-3 resize-none max-h-32" 
                rows={1} 
              />
              <div className="flex items-center gap-1 text-white shrink-0 ml-2">
                <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-2 hover:bg-white/20 rounded-full"><Paperclip className="w-[22px] h-[22px]" /></button>
                <button onClick={() => cameraInputRef.current?.click()} className="p-2 hover:bg-white/20 rounded-full"><Camera className="w-[22px] h-[22px]" /></button>
              </div>
            </div>
            <div className="shrink-0 mb-[1px]">
              <button onClick={messageText.trim() ? handleSendMessage : startRecording} className="w-[48px] h-[48px] bg-[#00E5FF] rounded-full flex items-center justify-center text-[#0f172a] shadow-md hover:scale-105 transition-transform">
                {messageText.trim() ? <Send strokeWidth={2} className="w-5 h-5 ml-1" /> : <Mic strokeWidth={2.5} className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
      </footer>

      {showAttachmentMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowAttachmentMenu(false)} />
          <div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-2xl p-4 z-40 grid grid-cols-3 gap-6 shadow-xl border border-slate-700/50">
            <div onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-2 relative z-50 cursor-pointer"><div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white"><ImageIcon /></div><span className="text-xs text-slate-300">Gallery</span></div>
            <div onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-2 relative z-50 cursor-pointer"><div className="w-14 h-14 bg-violet-500 rounded-full flex items-center justify-center text-white"><Camera /></div><span className="text-xs text-slate-300">Camera</span></div>
            <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 relative z-50 cursor-pointer"><div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white"><File /></div><span className="text-xs text-slate-300">File</span></div>
          </div>
        </>
      )}

      <input key={`gallery_${inputKey}`} type="file" accept="image/*,video/*" multiple ref={galleryInputRef} className="hidden" onChange={handleFileUpload} />
      <input key={`camera_${inputKey}`} type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileUpload} />
      <input key={`file_${inputKey}`} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,application/*" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
    </div>
  );
}
