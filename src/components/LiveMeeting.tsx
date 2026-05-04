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

    const getEnv = (key: string) => {
      try {
        if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key];
        if (typeof process !== 'undefined' && process.env) return process.env[key];
      } catch (e) {}
      return undefined;
    };

    const rawAppId = getEnv('VITE_ZEGO_APP_ID') || getEnv('NEXT_PUBLIC_ZEGO_APP_ID');
    const serverSecret = getEnv('VITE_ZEGO_SERVER_SECRET') || getEnv('NEXT_PUBLIC_ZEGO_SERVER_SECRET');
    const appID = Number(rawAppId);

    if (!appID || !serverSecret) {
      console.error("ZegoCloud keys are missing in environment variables!");
      containerRef.current.innerHTML = '<div class="w-full h-full flex items-center justify-center text-red-400 font-bold bg-slate-900">خطأ في الاتصال بالسيرفر (المفاتيح مفقودة)</div>';
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
