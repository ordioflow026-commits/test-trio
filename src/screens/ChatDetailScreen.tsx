import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Mic, Paperclip, Camera, Send, Image as ImageIcon, FileText, File } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function ChatDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, dir } = useLanguage();
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  
  // Extract contact from navigation state
  const contact = location.state?.contact || { name: 'Test User US', phone: '+1 555 012 3456', initials: 'US' };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    // Mock sending message
    console.log("Sending:", messageText);
    setMessageText('');
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
            onClick={() => navigate('/call', { state: { title: t('videoCall') || 'Video Call' }})}
            className="hover:text-slate-200 transition-colors"
          >
            <Video strokeWidth={1.5} className="w-[22px] h-[22px]" />
          </button>
          <button 
            onClick={() => navigate('/call', { state: { title: t('audioCall') || 'Voice Call' }})}
            className="hover:text-slate-200 transition-colors"
          >
            <Phone strokeWidth={1.5} className="w-[22px] h-[22px]" />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto w-full relative z-10 px-4">
         {/* Chat messages would go here */}
      </main>

      {/* Attachment Menu (Overlay) */}
      {showAttachmentMenu && (
        <div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-4 z-40 animate-in slide-in-from-bottom-2 fade-in">
          <div className="grid grid-cols-3 gap-6 py-2 px-1">
            <button className="flex flex-col items-center gap-2 group">
               <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <ImageIcon className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">Gallery</span>
            </button>
            <button className="flex flex-col items-center gap-2 group">
               <div className="w-14 h-14 rounded-full bg-violet-500 flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md">
                 <FileText className="w-6 h-6" />
               </div>
               <span className="text-xs text-slate-300 font-medium tracking-tight">Document</span>
            </button>
            <button className="flex flex-col items-center gap-2 group">
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

      {/* Footer / Input Bar */}
      <footer className="px-2 pb-3 flex items-end gap-2 z-40 w-full mb-safe">
        {/* Left Action Menu inside Pill */}
        <div className="flex-1 bg-[#009fb7] rounded-full flex items-center shadow-sm pl-4 pr-1 min-h-[48px]">
          <textarea 
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
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
