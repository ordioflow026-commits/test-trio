import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Mic, Paperclip, Camera, Send, Image as ImageIcon, FileText, File, Check, CheckCheck, Copy, Trash2, X, Square } from 'lucide-react';
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
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const longPressTimer = useRef<any>(null);
  const isLongPress = useRef(false);
  const [contactProfileId, setContactProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [inputKey, setInputKey] = useState(Date.now());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const contact = location.state?.contact || { name: 'Chat', phone: '', initials: '?' };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // SAFE INIT CHAT LOGIC
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    let channel: any = null;

    const initChat = async () => {
      console.log("Starting Chat Init for:", contact.phone);
      try {
        // 1. Clean phone number parsing
        const cleanPhone = contact.phone.replace(/\\D/g, '').slice(-9);
        console.log("Searching for cleaned phone profile:", cleanPhone);

        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .ilike('phone', `%${cleanPhone}%`)
          .maybeSingle();

        if (profileErr) console.error("Profile search error:", profileErr);
        
        const receiverId = profileData?.id || null;
        console.log("Receiver ID found:", receiverId);
        
        if (isMounted) setContactProfileId(receiverId);

        if (receiverId) {
          // 2. Fetch history
          const { data: history, error: historyErr } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

          if (isMounted && !historyErr && history) {
            setMessages(history.filter(m => m.deleted_for !== user.id));
          }

          // 3. Setup Realtime
          channel = supabase.channel(`chat_${user.id}_${receiverId}`)
            .on('postgres_changes', { 
                event: '*',
                schema: 'public', 
                table: 'messages',
            }, (payload) => {
              const newMsg = payload.new as Message;
              if (payload.eventType === 'DELETE') {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
              } else if (payload.eventType === 'UPDATE') {
                setMessages(prev => newMsg.deleted_for === user.id ? prev.filter(m => m.id !== newMsg.id) : prev.map(m => m.id === newMsg.id ? newMsg : m));
              } else if (payload.eventType === 'INSERT') {
                setMessages(prev => (prev.find(m => m.id === newMsg.id)) ? prev : [...prev, newMsg]);
              }
            })
            .subscribe();
        }
      } catch (err) {
        console.error("Critical Init Error:", err);
      } finally {
        // ✅ CRITICAL FIX: Always stop loading no matter what happens
        if (isMounted) {
          console.log("Loading finished.");
          setIsLoading(false);
        }
      }
    };

    initChat();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [contact.phone, user]);

  // Mark read logic
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!user || !contactProfileId || messages.length === 0 || document.visibilityState !== 'visible') return;
      const unreadMessages = messages.filter(m => m.receiver_id === user.id && m.status !== 'read');
      if (unreadMessages.length > 0) {
        await supabase.from('messages').update({ status: 'read' }).eq('receiver_id', user.id).eq('sender_id', contactProfileId).neq('status', 'read');
      }
    };
    markMessagesAsRead();
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') markMessagesAsRead(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages, user, contactProfileId]);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user || !contactProfileId) return;
    const files: File[] = Array.from(fileList);
    setShowAttachmentMenu(false);
    setUploadingCount(prev => prev + files.length);
    const memoryFiles: File[] = [];
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        let fileName = file.name || `file_${Date.now()}`;
        const isImageInput = e.target.accept && e.target.accept.includes('image');
        if ((file.type.startsWith('image/') || isImageInput) && !fileName.match(/\\.(jpg|jpeg|png|gif|webp)$/i)) fileName += '.jpg';
        const fileType = file.type || (fileName.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
        memoryFiles.push(new File([buffer], fileName, { type: fileType }));
      } catch (err) { console.error("Memory copy failed", err); }
    }
    setInputKey(Date.now());
    const localMessages: Message[] = memoryFiles.map(file => ({
      id: generateUUID(), sender_id: user.id, receiver_id: contactProfileId, content: `File: ${URL.createObjectURL(file)}${file.type.startsWith('image/') ? '#.jpg' : ''}`, created_at: new Date().toISOString(), status: 'sending'
    }));
    setMessages(prev => [...prev, ...localMessages]);
    for (let i = 0; i < memoryFiles.length; i++) {
      const file = memoryFiles[i];
      const msg = localMessages[i];
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      try {
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
        await supabase.from('messages').insert({ id: msg.id, sender_id: user.id, receiver_id: contactProfileId, content: `File: ${publicUrlData.publicUrl}`, status: 'sent' });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent', content: `File: ${publicUrlData.publicUrl}` } : m));
      } catch (err) { setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'error' } : m)); }
      finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !contactProfileId) return;
    const msgContent = messageText.trim();
    setMessageText('');
    const tempMsg: Message = { id: generateUUID(), sender_id: user.id, receiver_id: contactProfileId, content: msgContent, created_at: new Date().toISOString(), status: 'sending' };
    setMessages(prev => [...prev, tempMsg]);
    const { error } = await supabase.from('messages').insert({ id: tempMsg.id, sender_id: user.id, receiver_id: contactProfileId, content: msgContent, status: 'sent' });
    if (error) setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'error' } : m));
    else setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'sent' } : m));
  };

  const handleCopy = async () => { if (selectedMessage) { await navigator.clipboard.writeText(selectedMessage.content); setSelectedMessage(null); } };

  const handleDeleteForMe = async () => {
    if (!selectedMessage || !user) return;
    const msgToDelete = selectedMessage;
    setSelectedMessage(null);
    setMessages(prev => prev.filter(m => m.id !== msgToDelete.id)); 
    if (msgToDelete.deleted_for) await supabase.from('messages').delete().eq('id', msgToDelete.id);
    else await supabase.from('messages').update({ deleted_for: user.id }).eq('id', msgToDelete.id);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        if (!cancelRecordingRef.current) setRecordedAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const sendRecordedAudio = async () => {
    if (!recordedAudioBlob || !user || !contactProfileId) return;
    setUploadingCount(prev => prev + 1);
    try {
      const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webm`;
      const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, recordedAudioBlob, { contentType: 'audio/webm' });
      if (uploadError) throw uploadError;
      setRecordedAudioBlob(null);
      const { data: publicUrlData } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
      const { data: insertedMsg } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content: `Audio: ${publicUrlData.publicUrl}`, status: 'sent' }).select().single();
      if (insertedMsg) setMessages(prev => [...prev, insertedMsg]);
    } catch (err) { console.error(err); }
    finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] font-sans relative overflow-hidden" dir={dir}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3] opacity-80 pointer-events-none" />
      <header className="flex items-center justify-between px-3 py-4 z-20">
        <div className="flex items-center gap-3 flex-1">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-white hover:text-slate-200 transition-colors"><ArrowLeft strokeWidth={1.5} className="w-[22px] h-[22px]" /></button>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center text-white font-semibold text-sm shrink-0">{contact.initials}</div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-[17px] leading-tight truncate max-w-[150px]">{contact.name}</span>
              <span className="text-[13px] text-slate-300 mt-0.5">{contact.phone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5 text-white pr-2">
          <button onClick={() => { if (zp && contactProfileId) zp.sendCallInvitation({ callees: [{ userID: contactProfileId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16), userName: contact.name }], callType: 1, timeout: 60 }); }}><Video strokeWidth={1.5} className="w-[22px] h-[22px]" /></button>
          <button onClick={() => { if (zp && contactProfileId) zp.sendCallInvitation({ callees: [{ userID: contactProfileId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16), userName: contact.name }], callType: 0, timeout: 60 }); }}><Phone strokeWidth={1.5} className="w-[20px] h-[20px]" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full relative z-10 px-4 flex flex-col gap-3 py-4">
         {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
         ) : !contactProfileId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-in fade-in duration-300">
               <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mb-4 shadow-lg border border-slate-700/50"><X className="w-8 h-8 text-red-400" /></div>
               <p className="text-slate-200 font-medium text-lg mb-1">جهة الاتصال غير مسجلة</p>
               <p className="text-slate-400 text-sm">هذا الرقم غير مسجل في التطبيق. يرجى التأكد من أن الرقم صحيح ومسجل.</p>
            </div>
         ) : (
            <>
              {messages.length === 0 && <div className="flex items-center justify-center h-full text-slate-400 text-sm">Say hi to {contact.name}!</div>}
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(msg); }} className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm transition-transform active:scale-[0.98] ${isMe ? 'bg-[#00b4d8] text-white rounded-br-sm' : 'bg-slate-800/80 text-slate-100 rounded-bl-sm border border-slate-700/50'}`}>
                      {msg.content.startsWith('Audio: ') ? (
                        <div className="mt-1 pb-1 flex flex-col gap-1" dir="ltr" style={{ minWidth: '200px', width: '100%', maxWidth: '240px' }}>
                          <audio controls preload="metadata" src={msg.content.replace('Audio: ', '')} style={{ display: 'block', width: '100%', minWidth: '200px', maxWidth: '240px', height: '54px', flexShrink: 0 }} className="rounded-full bg-slate-100/10 outline-none" />
                        </div>
                      ) : msg.content.startsWith('File: ') ? (
                        <div className="mt-1">{msg.content.includes('#.jpg') ? <img src={msg.content.replace('File: ', '')} className="max-w-[200px] rounded-lg" /> : <a href={msg.content.replace('File: ', '')} target="_blank" className="text-white underline text-sm">Download File</a>}</div>
                      ) : <p className="text-[15px] whitespace-pre-wrap leading-tight">{msg.content}</p>}
                      <div className="flex items-center justify-end gap-1 mt-1 pb-0.5">
                        <p className={`text-[10px] ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        {msg.status === 'read' && <Check strokeWidth={3} className="w-[14px] h-[14px] text-[#00E5FF]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              {uploadingCount > 0 && <div className="flex justify-end mb-2"><div className="px-4 py-3 rounded-2xl bg-[#00b4d8] text-white shadow-sm flex items-center gap-3"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span className="text-sm">جاري الإرسال...</span></div></div>}
              <div ref={messagesEndRef} className="h-1" />
            </>
         )}
      </main>

      <footer className={`px-2 pb-3 z-40 w-full relative ${(!contactProfileId && !isLoading) ? 'pointer-events-none opacity-40' : ''}`}>
        {recordedAudioBlob ? (
          <div className="flex items-center gap-2 bg-[#009fb7] p-1 pl-2 rounded-[28px] shadow-sm"><button onClick={() => setRecordedAudioBlob(null)} className="p-3 bg-red-400 text-white rounded-full"><Trash2 className="w-5 h-5" /></button>
            <div className="flex-1 flex justify-center px-1" dir="ltr" style={{ minWidth: 0 }}><audio src={URL.createObjectURL(recordedAudioBlob)} controls style={{ width: '100%', minWidth: '200px', maxWidth: '240px', height: '50px' }} /></div>
            <button onClick={sendRecordedAudio} className="w-[48px] h-[48px] bg-white rounded-full flex items-center justify-center text-[#009fb7]"><Send className="w-5 h-5 ml-1" /></button>
          </div>
        ) : isRecording ? (
          <div className="flex items-center gap-2 bg-[#009fb7] p-1 pl-2 rounded-[28px] shadow-sm"><button onClick={() => setIsRecording(false)} className="p-3 bg-white/20 text-white rounded-full"><X className="w-5 h-5" /></button>
            <div className="flex-1 flex items-center justify-center gap-3 bg-white/10 rounded-full h-[48px]"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div><span className="text-white">جاري التسجيل...</span></div>
            <button onClick={() => { if(mediaRecorderRef.current) mediaRecorderRef.current.stop(); setIsRecording(false); }} className="w-[48px] h-[48px] bg-red-500 text-white rounded-full flex items-center justify-center"><Square className="w-5 h-5 fill-current" /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-[#009fb7] rounded-[28px] flex items-center shadow-sm pl-4 pr-1 min-h-[48px]"><textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Message" className="flex-1 bg-transparent text-white placeholder-white/80 py-3 outline-none resize-none overflow-y-auto leading-tight" rows={1} />
              <div className="flex items-center gap-1 text-white shrink-0 ml-2"><button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-2 hover:bg-white/20 rounded-full"><Paperclip strokeWidth={1.5} className="w-[22px] h-[22px]" /></button><button onClick={() => cameraInputRef.current?.click()} className="p-2 hover:bg-white/20 rounded-full"><Camera strokeWidth={1.5} className="w-[22px] h-[22px]" /></button></div>
            </div>
            <button onClick={messageText.trim() ? handleSendMessage : startRecording} className="w-[48px] h-[48px] bg-[#00E5FF] rounded-full flex items-center justify-center text-[#0f172a] shadow-md">{messageText.trim() ? <Send className="w-5 h-5 ml-1" /> : <Mic className="w-5 h-5" />}</button>
          </div>
        )}
      </footer>

      {showAttachmentMenu && <div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-2xl p-4 z-40 grid grid-cols-3 gap-6"><button onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white"><ImageIcon /></div><span className="text-xs text-slate-300">Gallery</span></button><button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="w-14 h-14 rounded-full bg-violet-500 flex items-center justify-center text-white"><Camera /></div><span className="text-xs text-slate-300">Camera</span></button><button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white"><File /></div><span className="text-xs text-slate-300">File</span></button></div>}
      <input key={`gallery_${inputKey}`} type="file" multiple ref={galleryInputRef} className="hidden" onChange={handleFileUpload} /><input key={`camera_${inputKey}`} type="file" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileUpload} /><input key={`file_${inputKey}`} type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
    </div>
  );
}
