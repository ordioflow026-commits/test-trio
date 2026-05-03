import React, { useState } from 'react';
import { UploadCloud, Loader2, PlaySquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext'; // Added Language Context

interface Props {
  url?: string;
  canInteract: boolean;
  onUploadSuccess: (url: string) => void;
}

export default function SyncMediaViewer({ url, canInteract, onUploadSuccess }: Props) {
  const [uploading, setUploading] = useState(false);
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const isVideo = (fileUrl: string) => {
    return /\.(mp4|webm|ogg|mov)$/i.test(fileUrl);
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
             src={url} 
             controls 
             className="max-w-full max-h-full rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] outline-none animate-in zoom-in duration-300"
          >
            {isAr ? 'متصفحك لا يدعم تشغيل الفيديو.' : 'Your browser does not support the video tag.'}
          </video>
        ) : (
          <img 
             src={url} 
             alt="Shared Media" 
             className="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in zoom-in duration-300" 
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
