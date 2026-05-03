import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Link as LinkIcon, Image as ImageIcon, FileText, Upload, Loader2, Edit3, ChevronUp } from 'lucide-react';

interface UniversalViewerProps {
  roomId?: string;
  canInteract?: boolean;
  isLocalOnly?: boolean;
}

export default function UniversalViewer({ roomId, canInteract = true, isLocalOnly = false }: UniversalViewerProps) {
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true); // Control toolbar visibility
  
  const channelRef = useRef<any>(null);
  const isRemoteUpdate = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`universal_doc_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'doc_sync' }, (payload) => {
      if (payload.payload.url !== undefined) {
        isRemoteUpdate.current = true;
        setUrl(payload.payload.url);
        setShowToolbar(false); // Auto-hide toolbar for guests when host changes file
      }
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const loadFile = () => {
    if (!canInteract || !inputUrl) return;
    setUrl(inputUrl);
    setShowToolbar(false); // Auto-hide toolbar after loading
    if (!isLocalOnly && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'doc_sync',
        payload: { url: inputUrl }
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canInteract) return;

    setIsUploading(true);
    try {
      const bucketName = 'room-media'; 
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `room_${roomId}/${fileName}`;

      const { error } = await supabase.storage.from(bucketName).upload(filePath, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(filePath);

      setUrl(publicUrl);
      setShowToolbar(false); // Auto-hide toolbar after successful upload
      
      if (!isLocalOnly && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'doc_sync',
          payload: { url: publicUrl }
        });
      }
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isImage = (testUrl: string) => {
    return /\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i.test(testUrl);
  };

  return (
    <div className="w-full h-full bg-slate-900 rounded-[32px] border border-slate-700/50 shadow-2xl flex flex-col overflow-hidden relative">
      
      {/* Floating Toggle Button (Visible only to Host when a URL is loaded) */}
      {url && canInteract && (
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="absolute top-4 left-4 z-[70] p-3 bg-slate-800/90 hover:bg-slate-700 backdrop-blur-md border border-cyan-500/50 rounded-full text-cyan-400 shadow-[0_4px_15px_rgba(0,180,216,0.3)] transition-all hover:scale-110"
          title={showToolbar ? "إخفاء شريط الرفع" : "تغيير الملف"}
        >
          {showToolbar ? <ChevronUp className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
        </button>
      )}

      {/* Top Toolbar - Auto-Hides */}
      {showToolbar && (
        <div className="bg-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between border-b border-slate-700 gap-3 z-10 relative pt-12 sm:pt-4 animate-in slide-in-from-top-4 duration-300">
          {canInteract && (
            <div className="flex flex-col sm:flex-row w-full gap-2 items-center pl-14 sm:pl-0">
              {/* Upload Button */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.ppt,.pptx"
              />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold text-sm shadow-md disabled:opacity-50 shrink-0"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isUploading ? 'Uploading...' : 'Upload File'}
              </button>

              <div className="hidden sm:block w-px h-6 bg-slate-600 mx-1" />

              {/* URL Input */}
              <div className="flex w-full gap-2">
                <input 
                  type="text" 
                  placeholder="Or paste link here..." 
                  className="w-full bg-slate-900 text-white px-3 py-2 text-sm rounded-lg border border-slate-600 focus:outline-none focus:border-cyan-500"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                />
                <button onClick={loadFile} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold text-sm shrink-0">
                  <LinkIcon className="w-4 h-4" /> Load
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document Display Area - Takes full remaining height */}
      <div className="flex-1 overflow-auto flex justify-center bg-slate-950 relative">
        {!url ? (
          <div className="flex flex-col items-center justify-center text-slate-500 h-full">
            <div className="flex gap-4 mb-4 opacity-50">
              <ImageIcon className="w-12 h-12" />
              <FileText className="w-12 h-12" />
            </div>
            <p className="text-center px-4">Upload a file from your device or paste a link.</p>
            <p className="text-xs mt-2 text-slate-600 text-center max-w-sm">Supports JPG, PNG, PDF, DOCX, and PPTX.</p>
          </div>
        ) : isImage(url) ? (
          <div className="w-full h-full flex items-center justify-center p-2">
            <img src={url} alt="Shared Resource" className="max-w-full max-h-full object-contain shadow-lg rounded-lg" />
          </div>
        ) : (
          <iframe 
            src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`} 
            className="w-full h-full border-0 bg-white"
            title="Document Viewer"
          />
        )}
      </div>
    </div>
  );
}
