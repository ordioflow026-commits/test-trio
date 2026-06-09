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
      const appID = 1524809815;
      const serverSecret = "d1c6a0e47c625b2d4459f547d52df57a".trim();
      
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
            mode: ZegoUIKitPrebuilt.VideoConference,
          },
          showPreJoinView: true, // تم التفعيل لتظهر شاشة الفحص والدخول مثل قوقل ميت
          turnOnMicrophoneWhenJoining: false,
          turnOnCameraWhenJoining: false,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: true, // تفعيل ميزة مشاركة الشاشة
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
    <div className="w-full h-full bg-slate-900" ref={containerRef} />
  );
}
