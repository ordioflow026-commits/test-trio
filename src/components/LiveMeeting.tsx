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

    const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || process.env.VITE_ZEGO_APP_ID || 21954096);
    const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || process.env.VITE_ZEGO_SERVER_SECRET || "97cfa92cfa956ce642305577c5296acd9a5b9242468bacdec4c7e550ac9fe761";

    // 100% Safe Room ID (English Only)
    const safeRoomId = "room_" + (roomId || "test").replace(/[^a-zA-Z0-9]/g, '');
    const finalRoomId = safeRoomId.length > 6 ? safeRoomId.substring(0, 20) : "room_test_123";

    // 100% Safe User ID
    const userID = "user_" + Math.random().toString(36).substring(2, 8);
    
    // 💡 100% Safe User Name: Force English to bypass ZegoCloud Arabic character rejection
    const finalUserName = "Participant_" + Math.floor(Math.random() * 1000);

    try {
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        finalRoomId,
        userID,
        finalUserName
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
      console.error("ZegoCloud Error:", error);
    }
  }, [roomId]); // Removed userName from dependency to prevent re-renders

  return (
    <div className="w-full h-full bg-[#0f172a] rounded-[32px] overflow-hidden relative border border-slate-700 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
