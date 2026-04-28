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
                  return prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg];
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !user || !contactProfileId) return;
    const files = Array.from(fileList);
    setShowAttachmentMenu(false);
    setUploadingCount(prev => prev + files.length);
    for (const file of files) {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      try {
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
        await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content: `File: ${publicUrlData.publicUrl}`, status: 'sent' });
      } catch (err) { console.error(err); }
      finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
    }
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
      await supabase.storage.from('chat-attachments').upload(`${user.id}/${fileName}`, recordedAudioBlob);
      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
      await supabase.from('messages').insert({ sender_id: user.id, receiver_id: contactProfileId, content: `Audio: ${data.publicUrl}`, status: 'sent' });
      setRecordedAudioBlob(null);
    } catch (err) { console.error(err); }
    finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] font-sans relative overflow-hidden" dir={dir}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3] opacity-80 pointer-events-none" />
      
      <header className="flex items-center justify-between px-3 py-4 z-20">
        <div className="flex items-center gap-3 flex-1 text-white">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="w-[22px] h-[22px]" /></button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center font-semibold shrink-0">{contact.initials}</div>
            <div className="flex flex-col">
              <span className="font-semibold text-[17px] leading-tight truncate max-w-[150px]">{contact.name}</span>
              <span className="text-[13px] text-slate-300 mt-0.5">{contact.phone}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full relative z-10 px-4 flex flex-col gap-3 py-4">
         {isLoading ? (
            <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
         ) : !contactProfileId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
               <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mb-4 border border-slate-700/50"><X className="w-8 h-8 text-red-400" /></div>
               <p className="text-slate-200 font-medium text-lg">جهة الاتصال غير مسجلة</p>
            </div>
         ) : (
            <>
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div onPointerDown={() => { longPressTimer.current = setTimeout(() => setSelectedMessage(msg), 400); }}
                         onPointerUp={() => clearTimeout(longPressTimer.current)}
                         className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm text-white ${isMe ? 'bg-[#00b4d8] rounded-br-none' : 'bg-slate-800/80 rounded-bl-none border border-slate-700/50'}`}>
                      {msg.content.startsWith('Audio: ') ? (
                        <div dir="ltr" style={{ minWidth: '200px', width: '100%', maxWidth: '240px' }}>
                          <audio controls src={msg.content.replace('Audio: ', '')} style={{ display: 'block', width: '100%', minWidth: '200px', height: '54px' }} className="outline-none" />
                        </div>
                      ) : msg.content.startsWith('File: ') ? (
                        <img src={msg.content.replace('File: ', '')} className="max-w-[200px] rounded-lg" alt="attachment" />
                      ) : <p className="text-[15px]">{msg.content}</p>}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
         )}
      </main>

      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMessage(null)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-xs overflow-hidden border border-slate-700" onClick={e => e.stopPropagation()}>
            <button onClick={() => { navigator.clipboard.writeText(selectedMessage.content); setSelectedMessage(null); }} className="w-full p-4 text-left text-white flex items-center gap-3 border-b border-slate-700 hover:bg-slate-700"><Copy className="w-5 h-5 text-blue-400" /> نسخ</button>
            <button onClick={handleDeleteForMe} className="w-full p-4 text-left text-red-400 flex items-center gap-3 hover:bg-slate-700"><Trash2 className="w-5 h-5" /> حذف لدي</button>
          </div>
        </div>
      )}

      <footer className={`px-2 pb-3 z-40 w-full relative ${(!contactProfileId && !isLoading) ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-end gap-2 bg-[#009fb7] rounded-[28px] p-1 px-4 shadow-sm">
          {recordedAudioBlob ? (
            <div className="flex items-center w-full gap-2 py-1">
              <button onClick={() => setRecordedAudioBlob(null)} className="p-2 bg-red-400 rounded-full text-white"><Trash2 className="w-5 h-5" /></button>
              <audio src={URL.createObjectURL(recordedAudioBlob)} controls className="flex-1 h-10" />
              <button onClick={sendRecordedAudio} className="p-2 bg-white rounded-full text-[#009fb7]"><Send className="w-5 h-5" /></button>
            </div>
          ) : isRecording ? (
            <div className="flex items-center justify-between w-full text-white py-2 px-2 animate-pulse">
              <span className="flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full" /> جاري التسجيل...</span>
              <Square onClick={() => mediaRecorderRef.current?.stop()} className="text-red-500 fill-current cursor-pointer" />
            </div>
          ) : (
            <>
              <textarea value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Message" className="flex-1 bg-transparent text-white outline-none py-3 resize-none" rows={1} />
              <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-2 text-white"><Paperclip className="w-[22px] h-[22px]" /></button>
              <button onClick={messageText.trim() ? handleSendMessage : startRecording} className="p-3 bg-[#00E5FF] text-[#0f172a] rounded-full shadow-md">
                {messageText.trim() ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </>
          )}
        </div>
      </footer>

      {showAttachmentMenu && (
        <div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-2xl p-4 z-40 grid grid-cols-3 gap-6 shadow-xl border border-slate-700/50">
          <div onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white"><ImageIcon /></div><span className="text-xs text-slate-300">Gallery</span></div>
          <div onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="w-14 h-14 bg-violet-500 rounded-full flex items-center justify-center text-white"><Camera /></div><span className="text-xs text-slate-300">Camera</span></div>
          <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2"><div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white"><File /></div><span className="text-xs text-slate-300">File</span></div>
        </div>
      )}

      <input key={`gallery_${inputKey}`} type="file" multiple ref={galleryInputRef} className="hidden" onChange={handleFileUpload} />
      <input key={`camera_${inputKey}`} type="file" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileUpload} />
      <input key={`file_${inputKey}`} type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
    </div>
  );
}
