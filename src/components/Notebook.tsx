import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, AlignJustify, Download, FileText as FileTxt, FileText as FileWord } from 'lucide-react';

interface NotebookProps {
  roomId?: string;
  canInteract?: boolean;
  isLocalOnly?: boolean;
}

export default function Notebook({ roomId, canInteract = true, isLocalOnly = false }: NotebookProps) {
  const [content, setContent] = useState('');
  const [isLined, setIsLined] = useState(false);
  const [showDlMenu, setShowDlMenu] = useState(false);
  const channelRef = useRef<any>(null);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`notes_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'notes_update' }, (payload) => {
      if (payload.payload.content !== undefined) {
        isRemoteUpdate.current = true;
        setContent(payload.payload.content);
      }
      if (payload.payload.isLined !== undefined) {
        setIsLined(payload.payload.isLined);
      }
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    if (!isLocalOnly && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast', event: 'notes_update', payload: { content: value }
      });
    }
  };

  const togglePaperStyle = () => {
    if (!canInteract) return;
    const newStyle = !isLined;
    setIsLined(newStyle);
    if (!isLocalOnly && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast', event: 'notes_update', payload: { isLined: newStyle }
      });
    }
  };

  const downloadNotes = (format: 'txt' | 'doc') => {
    if (!content.trim()) return;
    let blob;
    if (format === 'txt') {
      blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    } else {
      const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body dir="auto" style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6;"><p>${content.replace(/\n/g, '<br>')}</p></body></html>`;
      blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    }
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `notes_${Date.now()}.${format}`;
    link.click();
    setShowDlMenu(false);
  };

  return (
    <div className="w-full h-full bg-slate-100 rounded-[32px] border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col relative pointer-events-auto">
      
      <div className="absolute top-4 right-6 z-50 flex gap-3">
        
        <div className="relative">
          <button onClick={() => setShowDlMenu(!showDlMenu)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-cyan-400 hover:text-white hover:bg-slate-700 text-sm rounded-full shadow-lg transition-all" title="خيارات التحميل">
            <Download className="w-4 h-4"/>
            <span className="hidden sm:inline font-bold">تحميل</span>
          </button>
          {showDlMenu && (
            <div className="absolute top-12 right-0 bg-[#0f172a]/95 border border-slate-700/50 rounded-xl shadow-2xl backdrop-blur-xl p-2 min-w-[140px] animate-in fade-in zoom-in duration-200">
              <button onClick={() => downloadNotes('doc')} className="w-full flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-slate-200 text-sm font-bold transition-colors">
                <FileWord className="w-4 h-4 text-blue-400"/> ملف Word
              </button>
              <button onClick={() => downloadNotes('txt')} className="w-full flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-slate-200 text-sm font-bold transition-colors">
                <FileTxt className="w-4 h-4 text-slate-300"/> نص (TXT)
              </button>
            </div>
          )}
        </div>

        {canInteract && (
          <button onClick={togglePaperStyle} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-700 shadow-lg transition-colors" title="تغيير شكل الورقة">
            {isLined ? <AlignJustify className="w-4 h-4 text-cyan-400"/> : <FileText className="w-4 h-4 text-cyan-400"/>}
            <span className="hidden sm:inline font-bold">{isLined ? 'مخططة' : 'بيضاء'}</span>
          </button>
        )}
      </div>
      
      <div className="flex-1 w-full h-full p-4 pt-16">
        <textarea value={content} onChange={handleChange} disabled={!canInteract} placeholder={canInteract ? "اكتب ملاحظاتك المشتركة هنا..." : "في انتظار المضيف..."} className="w-full h-full resize-none outline-none bg-transparent text-slate-900 font-medium text-lg custom-scrollbar" style={{ lineHeight: '32px', backgroundImage: isLined ? 'repeating-linear-gradient(transparent, transparent 31px, #cbd5e1 31px, #cbd5e1 32px)' : 'none', backgroundAttachment: 'local' }} dir="auto" />
      </div>
    </div>
  );
}
