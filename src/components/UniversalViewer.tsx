import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Link as LinkIcon, Image as ImageIcon, FileText } from 'lucide-react';

interface UniversalViewerProps {
  roomId?: string;
  canInteract?: boolean;
  isLocalOnly?: boolean;
}

export default function UniversalViewer({ roomId, canInteract = true, isLocalOnly = false }: UniversalViewerProps) {
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const channelRef = useRef<any>(null);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`universal_doc_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'doc_sync' }, (payload) => {
      if (payload.payload.url !== undefined) {
        isRemoteUpdate.current = true;
        setUrl(payload.payload.url);
      }
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const loadFile = () => {
    if (!canInteract || !inputUrl) return;
    setUrl(inputUrl);
    if (!isLocalOnly && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'doc_sync',
        payload: { url: inputUrl }
      });
    }
  };

  // Helper to determine if the URL is a direct image
  const isImage = (testUrl: string) => {
    return /\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i.test(testUrl);
  };

  return (
    <div className="w-full h-full bg-slate-900 rounded-[32px] border border-slate-700/50 shadow-2xl flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between border-b border-slate-700 gap-3 z-10 relative pt-12 sm:pt-4">
        {canInteract && (
          <div className="flex flex-col sm:flex-row w-full gap-2">
            <input 
              type="text" 
              placeholder="Paste link here..." 
              className="w-full bg-slate-900 text-white px-3 py-2 text-sm rounded-lg border border-slate-600 focus:outline-none focus:border-cyan-500"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            <button onClick={loadFile} className="w-full sm:w-auto justify-center bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-bold text-sm">
              <LinkIcon className="w-4 h-4" /> Load
            </button>
          </div>
        )}
      </div>

      {/* Document Display Area */}
      <div className="flex-1 overflow-auto flex justify-center bg-slate-950 p-2 relative">
        {!url ? (
          <div className="flex flex-col items-center justify-center text-slate-500 h-full">
            <div className="flex gap-4 mb-4 opacity-50">
              <ImageIcon className="w-12 h-12" />
              <FileText className="w-12 h-12" />
            </div>
            <p>Waiting for a document or image link...</p>
            <p className="text-xs mt-2 text-slate-600 text-center max-w-sm">Supports direct links to JPG, PNG, PDF, DOCX, and PPTX.</p>
          </div>
        ) : isImage(url) ? (
          <div className="w-full h-full flex items-center justify-center overflow-auto">
            <img src={url} alt="Shared Resource" className="max-w-full max-h-full object-contain shadow-lg rounded-lg" />
          </div>
        ) : (
          <iframe 
            src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`} 
            className="w-full h-full border-0 bg-white rounded-lg"
            title="Document Viewer"
          />
        )}
      </div>
    </div>
  );
}
