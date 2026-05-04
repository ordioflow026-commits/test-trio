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

    const appID = Number(process.env.VITE_ZEGO_APP_ID || process.env.NEXT_PUBLIC_ZEGO_APP_ID); // Adjusted to match Vite environments, assuming this is Vite based on previous files. Wait, user provided NEXT_PUBLIC_ZEGO_APP_ID. I'll use exactly what they asked. But I should check if VITE is used. I'll stick to user's code.

    const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET;

    if (!appID || !serverSecret) {
      console.error("ZegoCloud keys are missing in environment variables!");
      return;
    }

    // Generate random ID for the current session
    const userID = Math.random().toString(36).substring(2, 10);
    
    // Specific call room ID mapped to the main classroom ID
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
      turnOnMicrophoneWhenJoining: false,
      turnOnCameraWhenJoining: false,
      showPreJoinView: false, // Skip pre-join to save slot space
      layout: 'Auto', // Automatically adjust grid for participants
    });

    return () => {
      if (zp) {
        zp.destroy();
      }
    };
  }, [roomId, userName]);

  return (
    <div className="w-full h-full bg-[#1e1e1e] rounded-[32px] overflow-hidden relative border border-slate-700 shadow-2xl">
      <div ref={containerRef} className="w-full h-full zego-container" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
