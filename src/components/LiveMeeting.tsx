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

    // Safe extraction with explicit fallbacks to unblock the user immediately
    // @ts-ignore
    const envAppId = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ZEGO_APP_ID : undefined;
    // @ts-ignore
    const envSecret = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ZEGO_SERVER_SECRET : undefined;
    
    // Fallback directly to the provided keys if Vite fails to load them
    const rawAppId = envAppId || process.env.NEXT_PUBLIC_ZEGO_APP_ID || "21954096";
    const serverSecret = envSecret || process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || "97cfa92cfa956ce642305577c5296acd9a5b9242468bacdec4c7e550ac9fe761";
    
    const appID = Number(rawAppId);

    if (!appID || !serverSecret) {
      console.error("ZegoCloud keys are missing!");
      containerRef.current.innerHTML = '<div class="w-full h-full flex items-center justify-center text-red-400 font-bold bg-slate-900">خطأ في الاتصال بالسيرفر</div>';
      return;
    }

    const userID = Math.random().toString(36).substring(2, 10);
    const callRoomId = `live_${roomId}`;

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      callRoomId,
      userID,
      userName
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);

    zp.joinRoom({
      container: containerRef.current,
      scenario: {
        mode: ZegoUIKitPrebuilt.VideoConference,
      },
      showScreenSharingButton: true,
      turnOnMicrophoneWhenJoining: true,
      turnOnCameraWhenJoining: true,
      showPreJoinView: false,
      layout: 'Auto',
      showUserList: false,
    });

    return () => {
      if (zp) {
        zp.destroy();
      }
    };
  }, [roomId, userName]);

  return (
    <div className="w-full h-full bg-[#1e1e1e] rounded-[32px] overflow-hidden relative border border-slate-700 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
