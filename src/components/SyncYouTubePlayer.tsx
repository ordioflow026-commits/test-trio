import React, { useEffect, useRef } from 'react';
import YouTube, { YouTubeEvent } from 'react-youtube';
import { supabase } from '../lib/supabase';

interface Props {
  videoId?: string;
  isHost: boolean;
  roomId: string;
  canInteract: boolean;
  isActive: boolean;
}

export default function SyncYouTubePlayer({ videoId, isHost, roomId, canInteract, isActive }: Props) {
  const playerRef = useRef<any>(null);
  const isReceivingSync = useRef(false);
  const channelRef = useRef<any>(null);

  // Smart URL parser to extract ID from full YouTube links
  const getYouTubeId = (url: string) => {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : url;
  };

  const cleanVideoId = getYouTubeId(videoId || '');

  useEffect(() => {
    if (!isActive && playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo();
    }
  }, [isActive]);

  useEffect(() => {
    if (!roomId) return;
    
    const channel = supabase.channel(`youtube_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'video_sync' }, (payload) => {
       if (!playerRef.current) return;
       const { action, time } = payload.payload;
       
       isReceivingSync.current = true; 
       
       if (action === 'PLAY') {
           playerRef.current.seekTo(time, true);
           playerRef.current.playVideo();
       } else if (action === 'PAUSE') {
           playerRef.current.seekTo(time, true);
           playerRef.current.pauseVideo();
       }
       
       setTimeout(() => { isReceivingSync.current = false; }, 500);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
  };

  const handlePlay = (event: YouTubeEvent) => {
    if (canInteract && !isReceivingSync.current && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'video_sync',
        payload: { action: 'PLAY', time: event.target.getCurrentTime() }
      });
    }
  };

  const handlePause = (event: YouTubeEvent) => {
    if (canInteract && !isReceivingSync.current && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'video_sync',
        payload: { action: 'PAUSE', time: event.target.getCurrentTime() }
      });
    }
  };

  if (!cleanVideoId) return null;

  return (
    <div className="absolute inset-0 w-full h-full bg-black pointer-events-auto">
      <YouTube
        videoId={cleanVideoId}
        opts={{
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: canInteract ? 1 : 0,
            disablekb: canInteract ? 0 : 1,
            modestbranding: 1,
            rel: 0
          }
        }}
        onReady={handleReady}
        onPlay={handlePlay}
        onPause={handlePause}
        className="w-full h-full"
        iframeClassName="w-full h-full border-0"
      />
    </div>
  );
}
