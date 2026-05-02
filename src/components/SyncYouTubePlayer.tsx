import React, { useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { supabase } from '../lib/supabase';

interface Props {
  videoId: string;
  isHost: boolean;
  roomId: string;
  canInteract: boolean;
}

const SyncYouTubePlayer: React.FC<Props> = ({ videoId, isHost, roomId, canInteract }) => {
  const playerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const isReceivingSync = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`youtube_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'video_sync' }, (payload) => {
      if (playerRef.current) {
        const { action, time } = payload.payload;
        
        isReceivingSync.current = true;
        
        if (action === 'PLAY') {
          playerRef.current.seekTo(time, true);
          playerRef.current.playVideo();
        } else if (action === 'PAUSE') {
          playerRef.current.seekTo(time, true);
          playerRef.current.pauseVideo();
        }
        
        setTimeout(() => {
          isReceivingSync.current = false;
        }, 500);
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isHost]);

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      controls: canInteract ? 1 : 0,
      disablekb: canInteract ? 0 : 1,
      modestbranding: 1,
    },
  };

  const handleReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
  };

  const handlePlay: YouTubeProps['onPlay'] = (event) => {
    if (canInteract && !isReceivingSync.current && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'video_sync',
        payload: { action: 'PLAY', time: event.target.getCurrentTime() },
      });
    }
  };

  const handlePause: YouTubeProps['onPause'] = (event) => {
    if (canInteract && !isReceivingSync.current && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'video_sync',
        payload: { action: 'PAUSE', time: event.target.getCurrentTime() },
      });
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={handleReady}
        onPlay={handlePlay}
        onPause={handlePause}
        className="w-full h-full pointer-events-auto"
        iframeClassName="w-full h-full"
      />
    </div>
  );
};

export default SyncYouTubePlayer;
