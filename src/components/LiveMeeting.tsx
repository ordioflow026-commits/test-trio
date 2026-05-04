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

    // Safe extraction with direct fallbacks to guarantee 100% connection
    // @ts-ignore
    const envAppId = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ZEGO_APP_ID : undefined;
    // @ts-ignore
    const envSecret = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ZEGO_SERVER_SECRET : undefined;
    
    const appID = Number(envAppId || process.env.NEXT_PUBLIC_ZEGO_APP_ID || 21954096);
    const serverSecret = envSecret || process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || "97cfa92cfa956ce642305577c5296acd9a5b9242468bacdec4c7e550ac9fe761";

    // 💡 FIX FOR ERROR 1002011: Encode Arabic/Special characters to Zego-safe English format
    const safeRoomId = encodeURIComponent(roomId || 'default_room').replace(/%/g, '_').substring(0, 100);
    const callRoomId = `live_${safeRoomId}`;

    const userID = Math.random().toString(36).substring(2, 10);
    const safeUserName = userName || 'مستخدم';

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
    } catch (error) {
      console.error("ZegoCloud Initialization Error:", error);
    }
  }, [roomId, userName]);

  return (
    <div className="w-full h-full bg-[#1e1e1e] rounded-[32px] overflow-hidden relative border border-slate-700 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
