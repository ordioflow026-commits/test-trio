import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { supabase } from '../lib/supabase';
import { FileText, AlignJustify } from 'lucide-react';

interface DocumentViewerProps {
  roomId?: string;
  canInteract?: boolean;
  isLocalOnly?: boolean;
}

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
  ],
};

export default function DocumentViewer({ roomId, canInteract = true, isLocalOnly = false }: DocumentViewerProps) {
  const [content, setContent] = useState('');
  const [isLined, setIsLined] = useState(false);
  const channelRef = useRef<any>(null);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`doc_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'doc_update' }, (payload) => {
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

  const handleChange = (value: string) => {
    setContent(value);
    if (isRemoteUpdate.current) {
       isRemoteUpdate.current = false;
       return;
    }
    if (!isLocalOnly && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'doc_update',
        payload: { content: value }
      });
    }
  };

  const togglePaperStyle = () => {
    if (!canInteract) return;
    const newStyle = !isLined;
    setIsLined(newStyle);
    if (!isLocalOnly && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'doc_update',
        payload: { isLined: newStyle }
      });
    }
  };

  return (
    <div className="w-full h-full bg-slate-100 rounded-[32px] border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col relative pointer-events-auto">
      {canInteract && (
        <div className="absolute top-2 right-4 z-50 flex gap-2">
          <button 
            onClick={togglePaperStyle}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-700 shadow-md transition-colors"
            title="تغيير شكل الورقة"
          >
            {isLined ? <AlignJustify className="w-4 h-4 text-cyan-400" /> : <FileText className="w-4 h-4 text-cyan-400" />}
            <span className="hidden sm:inline">{isLined ? 'ورقة مخططة' : 'ورقة بيضاء'}</span>
          </button>
        </div>
      )}
      
      <div 
        className={`flex-1 overflow-hidden transition-all duration-300 ${!canInteract ? 'opacity-90' : ''}`}
        style={{
          backgroundColor: '#ffffff',
          backgroundImage: isLined ? 'repeating-linear-gradient(transparent, transparent 31px, #e2e8f0 31px, #e2e8f0 32px)' : 'none',
          backgroundAttachment: 'local'
        }}
      >
        <ReactQuill 
          theme="snow" 
          value={content} 
          onChange={handleChange}
          readOnly={!canInteract}
          modules={modules}
          className="h-full text-black"
          style={{ height: 'calc(100% - 42px)' }} 
        />
      </div>
    </div>
  );
}
