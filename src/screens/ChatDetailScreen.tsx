import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Mic, Paperclip, Image, Send, File, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function ChatDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, dir } = useLanguage();
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  
  // Extract contact from navigation state
  const contact = location.state?.contact || { name: 'Unknown Contact', phone: '' };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    // Mock sending message
    console.log("Sending:", messageText);
    setMessageText('');
  };

  return (
    <div className="flex flex-col h-screen bg-[#ece5dd] font-sans relative" dir={dir}>
      {/* WhatsApp-style Header */}
      <header className="bg-[#075e54] text-white flex items-center justify-between px-2 py-3 shadow-md z-20">
        <div className="flex items-center gap-2 flex-1">
          <button 
            onClick={() => navigate(-1)} 
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 flex-1 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-bold text-lg overflow-hidden shrink-0">
               {contact.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-[17px] leading-tight truncate max-w-[150px]">{contact.name}</span>
              <span className="text-xs text-white/80">online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => navigate('/call', { state: { title: t('videoCall') || 'Video Call' }})}
            className="p-3 rounded-full hover:bg-white/10 transition-colors"
          >
            <Video className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={() => navigate('/call', { state: { title: t('audioCall') || 'Voice Call' }})}
            className="p-3 rounded-full hover:bg-white/10 transition-colors"
          >
            <Phone className="w-5 h-5 fill-current" />
          </button>
        </div>
      </header>

      {/* Chat Area - WhatsApp typical light patterned background */}
      <main className="flex-1 overflow-y-auto w-full relative z-10"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-solid-color-whatsapp.jpg")',
          backgroundSize: '400px',
          backgroundRepeat: 'repeat',
          opacity: 0.9
        }}
      >
         {/* Mock chat bubbles could go here */}
         <div className="p-4 flex flex-col gap-3">
            <div className="bg-white px-3 py-2 rounded-lg rounded-tl-sm w-fit max-w-[80%] shadow-sm text-[15px] text-[#111b21] ml-2">
               Hello! Messages to {contact.name} ({contact.phone}) will appear here.
               <span className="text-[11px] text-slate-400 block text-right mt-1">11:42 AM</span>
            </div>
         </div>
      </main>

      {/* Attachment Menu (Overlay) */}
      {showAttachmentMenu && (
        <div className="absolute bottom-20 left-4 right-4 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-40 animate-in slide-in-from-bottom-2 fade-in">
          <div className="grid grid-cols-3 gap-6 py-2 px-1">
            <button className="flex flex-col items-center gap-2 group">
               <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <Image className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-600 font-medium tracking-tight">Gallery</span>
            </button>
            <button className="flex flex-col items-center gap-2 group">
               <div className="w-14 h-14 rounded-full bg-violet-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <FileText className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-600 font-medium tracking-tight">Document</span>
            </button>
            <button className="flex flex-col items-center gap-2 group">
               <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <File className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-600 font-medium tracking-tight">File</span>
            </button>
          </div>
        </div>
      )}

      {/* Background Dimmer when Attachment Menu is open */}
      {showAttachmentMenu && (
          <div 
            className="absolute inset-0 bg-transparent z-30" 
            onClick={() => setShowAttachmentMenu(false)}
          />
      )}

      {/* Footer / Input Bar */}
      <footer className="bg-[#f0f2f5] p-2 flex items-end gap-2 z-40 sticky bottom-0 w-full mb-safe">
        {/* Left Action Menu */}
        <div className="bg-white rounded-3xl flex-1 flex items-end shadow-sm">
          <button 
            className="p-3.5 text-[#54656f] hover:bg-slate-50 transition-colors rounded-full rounded-tr-none rounded-br-none shrink-0"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          >
            <Paperclip className="w-6 h-6" />
          </button>
          
          <textarea 
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Message"
            className="flex-1 max-h-32 bg-transparent text-[#111b21] py-3.5 outline-none resize-none px-2 overflow-y-auto leading-tight"
            rows={1}
            dir={dir}
            onFocus={() => setShowAttachmentMenu(false)}
          />
        </div>

        {/* Right Action Button (Mic / Send) */}
        <div className="shrink-0 mb-0.5">
          {messageText.trim().length > 0 ? (
            <button 
              onClick={handleSendMessage}
              className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#008f6f] transition-colors animate-in zoom-in"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#008f6f] transition-colors">
              <Mic className="w-6 h-6" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
