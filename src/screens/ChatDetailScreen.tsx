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
          const { data: history, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

          if (isMounted && !error && history) {
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
                  return prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg];
                });
              }
            })
            .subscribe();
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        if (isMounted) setIsLoading(false); // ✅ ضمان توقف التحميل دائماً
      }
    };

    initChat();
    return () => { isMounted = false; if (channel) supabase.removeChannel(channel); };
  }, [contact.phone, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user || !contactProfileId) return;
    const files: File[] = Array.from(fileList);
    setShowAttachmentMenu(false);
    setUploadingCount(prev => prev + files.length);
    
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      try {
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, new File([buffer], fileName, { type: file.type }));
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
        await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content: `File: ${publicUrlData.publicUrl}`, status: 'sent' });
      } catch (err) { console.error(err); }
      finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
    }
    setInputKey(Date.now());
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !contactProfileId) return;
    const content = messageText.trim();
    setMessageText('');
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content, status: 'sent' });
  };

  const handleDeleteForMe = async () => {
    if (!selectedMessage || !user) return;
    const msgId = selectedMessage.id;
    setSelectedMessage(null);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await supabase.from('messages').update({ deleted_for: user.id }).eq('id', msgId);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => setRecordedAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const sendRecordedAudio = async () => {
    if (!recordedAudioBlob || !user || !contactProfileId) return;
    setUploadingCount(prev => prev + 1);
    const fileName = `audio_${Date.now()}.webm`;
    try {
      await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, recordedAudioBlob, { contentType: 'audio/webm' });
      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
      await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content: `Audio: ${data.publicUrl}`, status: 'sent' });
      setRecordedAudioBlob(null);
    } catch (err) { console.error(err); }
    finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] font-sans relative overflow-hidden" dir={dir}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3] opacity-80" />
      <header className="flex items-center justify-between px-3 py-4 z-20 text-white">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6" /></button>
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">{contact.initials}</div>
          <div><div className="font-bold">{contact.name}</div><div className="text-xs opacity-70">{contact.phone}</div></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto z-10 px-4 flex flex-col gap-3 py-4">
        {isLoading ? <div className="flex justify-center mt-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div> : 
         !contactProfileId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
               <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mb-4 border border-slate-700/50"><X className="w-8 h-8 text-red-400" /></div>
               <p className="text-slate-200 font-medium text-lg mb-1">جهة الاتصال غير مسجلة</p>
               <p className="text-slate-400 text-sm">يرجى التأكد من أن الرقم صحيح ومسجل.</p>
            </div>
         ) : (
            <>
              {messages.length === 0 && <div className="text-center text-slate-400 mt-10">Say hi to {contact.name}!</div>}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      onPointerDown={() => { longPressTimer.current = setTimeout(() => setSelectedMessage(msg), 400); }}
                      onPointerUp={() => clearTimeout(longPressTimer.current)}
                      className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${isMe ? 'bg-[#00b4d8] text-white rounded-br-none' : 'bg-slate-800/80 text-white rounded-bl-none border border-slate-700'}`}
                    >
                      {msg.content.startsWith('Audio: ') ? (
                        <div dir="ltr" style={{ minWidth: '200px', width: '100%', maxWidth: '240px' }}>
                          <audio controls src={msg.content.replace('Audio: ', '')} className="w-full h-12" style={{ display: 'block', minWidth: '200px', height: '54px' }} />
                        </div>
                      ) : msg.content.startsWith('File: ') ? (
                        <img src={msg.content.replace('File: ', '')} className="max-w-full rounded-lg" />
                      ) : <p className="text-[15px]">{msg.content}</p>}
                      <div className="flex justify-end gap-1 mt-1">
                        <span className="text-[10px] opacity-60">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.status === 'read' && <Check className="w-3 h-3 text-[#00E5FF]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
         )}
         <div ref={messagesEndRef} />
      </main>

      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMessage(null)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-xs overflow-hidden border border-slate-700" onClick={e => e.stopPropagation()}>
            <button onClick={() => { navigator.clipboard.writeText(selectedMessage.content); setSelectedMessage(null); }} className="w-full p-4 text-left text-white flex items-center gap-3 border-b border-slate-700 hover:bg-slate-700"><Copy className="w-5 h-5 text-blue-400" /> نسخ</button>
            <button onClick={handleDeleteForMe} className="w-full p-4 text-left text-red-400 flex items-center gap-3 hover:bg-slate-700"><Trash2 className="w-5 h-5" /> حذف لدي</button>
          </div>
        </div>
      )}

      <footer className={`p-2 z-40 ${(!contactProfileId && !isLoading) ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="bg-[#009fb7] rounded-full flex items-center p-1 px-4 shadow-lg min-h-[54px]">
          {recordedAudioBlob ? (
            <>
              <button onClick={() => setRecordedAudioBlob(null)} className="p-2 bg-red-400 rounded-full text-white mr-2"><Trash2 className="w-5 h-5" /></button>
              <audio src={URL.createObjectURL(recordedAudioBlob)} controls className="flex-1 h-10" />
              <button onClick={sendRecordedAudio} className="p-2 bg-white rounded-full text-[#009fb7] ml-2"><Send className="w-5 h-5" /></button>
            </>
          ) : isRecording ? (
            <div className="flex-1 flex items-center justify-between text-white"><X onClick={() => setIsRecording(false)} /><span>جاري التسجيل...</span><Square onClick={() => mediaRecorderRef.current?.stop()} className="text-red-500 fill-current" /></div>
          ) : (
            <>
              <textarea value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Message" className="flex-1 bg-transparent text-white outline-none py-3 resize-none" rows={1} />
              <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-2 text-white"><Paperclip /></button>
              <button onClick={messageText.trim() ? handleSendMessage : startRecording} className="p-3 bg-[#00E5FF] text-[#0f172a] rounded-full ml-1 shadow-md">{messageText.trim() ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
            </>
          )}
        </div>
      </footer>

      {showAttachmentMenu && (
        <div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-3xl p-6 z-40 grid grid-cols-3 gap-4 border border-slate-700 shadow-2xl">
          <div onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="p-4 bg-blue-500 rounded-full text-white"><ImageIcon /></div><span className="text-xs text-white">Gallery</span></div>
          <div onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="p-4 bg-violet-500 rounded-full text-white"><Camera /></div><span className="text-xs text-white">Camera</span></div>
          <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="p-4 bg-green-500 rounded-full text-white"><File /></div><span className="text-xs text-white">File</span></div>
        </div>
      )}
      <input key={`gallery_${inputKey}`} type="file" multiple ref={galleryInputRef} className="hidden" onChange={handleFileUpload} />
      <input key={`camera_${inputKey}`} type="file" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileUpload} />
      <input key={`file_${inputKey}`} type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
    </div>
  );
}
