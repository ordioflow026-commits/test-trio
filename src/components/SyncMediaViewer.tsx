import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Loader2, PlaySquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  url?: string;
  canInteract: boolean;
  onUploadSuccess: (url: string) => void;
  roomId?: string;
  isHost?: boolean;
  slotIndex?: number;
  viewMode?: 'sync' | 'free';
  isLocalOnly?: boolean;
}

export default function SyncMediaViewer({ url, canInteract, onUploadSuccess, roomId, isHost = false, slotIndex = 0, viewMode = 'sync', isLocalOnly = false }: Props) {
  const [uploading, setUploading] = useState(false);
  const { language } = useLanguage();
  const isAr = language === 'ar';
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);
  const isRemoteUpdate = useRef(false);

  const isVideo = (fileUrl: string) => {
    return /\.(mp4|webm|ogg|mov)$/i.test(fileUrl);
  };

  // 1. Realtime Video Synchronization Engine (Collaborative)
  useEffect(() => {
    if (!url || !isVideo(url) || !roomId) return;

    const channelName = `media_sync_${roomId}_${slotIndex}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'video_state_change' }, (payload) => {
      const { type, time } = payload.payload;
      const vid = videoRef.current;
      if (!vid) return;

      // EVERYONE listens to sync signals now, creating a collaborative watch party!
      isRemoteUpdate.current = true; // Lock local events to prevent infinite echo loops

      // Force sync time if the difference is more than 0.5 seconds
      if (Math.abs(vid.currentTime - time) > 0.5) {
        vid.currentTime = time;
      }

      // Sync playback state
      if (type === 'play' && vid.paused) {
        vid.play().catch(() => {}); 
      } else if (type === 'pause' && !vid.paused) {
        vid.pause();
      }

      // Release the lock after applying changes
      setTimeout(() => { isRemoteUpdate.current = false; }, 300);
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [url, roomId, slotIndex]); // Removed viewMode and isHost from dependencies as they no longer block sync

  // 2. Broadcast Local Actions (Anyone with canInteract can control the room)
  const emitVideoEvent = (type: 'play' | 'pause' | 'seek') => {
    const vid = videoRef.current;
    // If remote update is running, OR if the user doesn't have permission to interact, block broadcasting
    if (!channelRef.current || !vid || isRemoteUpdate.current || !canInteract) return;

    if (!isLocalOnly) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'video_state_change',
        payload: { type, time: vid.currentTime }
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('room-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('room-media').getPublicUrl(fileName);
      onUploadSuccess(data.publicUrl);
    } catch (error: any) {
      alert(isAr ? `فشل الرفع: ${error.message}` : `Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/50 p-2 relative">
        {isVideo(url) ? (
          <video 
             ref={videoRef}
             src={url} 
             controls={canInteract} // Only people allowed to interact see the controls
             onPlay={() => {
               console.log('🟢 المضيف/الزائر ضغط تشغيل: هذا الحدث محلي ولم يرسل للإنترنت!');
               emitVideoEvent('play');
             }}
             onPause={() => {
               console.log('🔴 المضيف/الزائر ضغط إيقاف: هذا الحدث محلي ولم يرسل للإنترنت!');
               emitVideoEvent('pause');
             }}
             onSeeked={() => emitVideoEvent('seek')}
             onTimeUpdate={(e) => console.log('⏳ وقت الفيديو يتغير محلياً:', e.currentTarget.currentTime)}
             className="max-w-full max-h-full rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] outline-none animate-in zoom-in duration-300 pointer-events-auto"
          >
            {isAr ? 'متصفحك لا يدعم تشغيل الفيديو.' : 'Your browser does not support the video tag.'}
          </video>
        ) : (
          <img 
             src={url} 
             alt="Shared Media" 
             className="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in zoom-in duration-300 pointer-events-auto" 
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-900/80 flex flex-col items-center justify-center p-6 text-center">
      <PlaySquare className="w-20 h-20 text-emerald-500/50 mb-6" />
      <h2 className="text-2xl text-white font-bold mb-6">
        {isAr ? 'عرض الوسائط (صور / فيديو)' : 'Media Viewer (Image / Video)'}
      </h2>
      
      {canInteract ? (
        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
          {uploading 
            ? (isAr ? 'جاري الرفع...' : 'Uploading...') 
            : (isAr ? 'اختر ملفاً من جهازك' : 'Choose a file from your device')}
          <input type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      ) : (
        <p className="text-emerald-500/70 font-mono tracking-widest uppercase text-sm">
          {isAr ? 'في انتظار المضيف لرفع الوسائط...' : 'Waiting for host to upload media...'}
        </p>
      )}
    </div>
  );
}
