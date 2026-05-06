import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

interface LiveMeetingProps {
  roomId: string;
  userName: string;
}

export default function LiveMeeting({ roomId, userName }: LiveMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    // @ts-ignore
    const envAppId = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ZEGO_APP_ID : undefined;
    // @ts-ignore
    const envSecret = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ZEGO_SERVER_SECRET : undefined;
    
    const appID = Number(envAppId || process.env.NEXT_PUBLIC_ZEGO_APP_ID || 21954096);
    const serverSecret = envSecret || process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || "97cfa92cfa956ce642305577c5296acd9a5b9242468bacdec4c7e550ac9fe761";

    // 💡 AGGRESSIVE SANITIZATION: Strip ALL characters except English letters and numbers to 100% guarantee no 1002011 errors.
    const cleanRoomId = (roomId || '').replace(/[^a-zA-Z0-9]/g, '');
    const callRoomId = `live_${cleanRoomId || 'default123'}`.substring(0, 50);

    const userID = Math.random().toString(36).substring(2, 10);
    const safeUserName = userName || 'User';

    try {
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        callRoomId,
        userID,
        safeUserName
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);

      zp.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.VideoConference,
        },
        showScreenSharingButton: true,
        turnOnMicrophoneWhenJoining: false, // Changed to false to prevent initial echo
        turnOnCameraWhenJoining: false,     // Changed to false to let user choose when ready
        showPreJoinView: false,
        layout: 'Auto',
        showUserList: false,
      });

      return () => {
        if (zp) {
          zp.destroy();
        }
      };
    } catch (error) {
      console.error("ZegoCloud Initialization Error:", error);
    }
  }, [roomId, userName]);

  return (
    <div className="w-full h-full bg-[#0f172a] rounded-[32px] overflow-hidden relative border border-slate-700 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
