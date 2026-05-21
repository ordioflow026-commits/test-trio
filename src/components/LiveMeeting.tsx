import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useUser } from '../contexts/UserContext';

interface LiveMeetingProps {
  roomId: string;
  userName: string;
}

export default function LiveMeeting({ roomId, userName }: LiveMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const { user } = useUser();

  useEffect(() => {
    if (!containerRef.current || !user) return;

    let isMounted = true;

    const initMeeting = async () => {
      const appID = 21954096;
      const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4".trim();
      
      // Unique Sub-Room ID to avoid collision with TripleScreenRoom audio
      const liveRoomId = `vid_${roomId.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      // Unique User ID to avoid token mismatch
      const uniqueUserId = (user.id || 'u').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) + '_cam';

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID, 
        serverSecret, 
        liveRoomId, 
        uniqueUserId, 
        userName
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;

      if (isMounted) {
        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.GroupCall,
          },
          // Prompts user to choose Camera/Mic before entering
          showPreJoinView: true, 
          
          turnOnMicrophoneWhenJoining: false,
          turnOnCameraWhenJoining: false,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: false,
          showLeavingView: false,
          layout: "Auto",
          branding: {
            logoURL: ""
          }
        });
      }
    };

    initMeeting();

    return () => {
      isMounted = false;
      if (zpRef.current) {
        try { zpRef.current.destroy(); } catch(e) {}
        zpRef.current = null;
      }
    };
  }, [roomId, user, userName]);

  return (
    <div className="w-full h-full bg-slate-900 relative overflow-hidden rounded-2xl">
      <div className="w-full h-full" ref={containerRef} />
    </div>
  );
}
