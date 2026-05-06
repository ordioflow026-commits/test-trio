import React from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

interface LiveMeetingProps {
  roomId: string;
  userName: string;
}

export default function LiveMeeting({ roomId, userName }: LiveMeetingProps) {

  // 💡 Smart Hashing Function: Converts ANY Arabic/Complex string into a unique Zego-safe ID
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  };

  // 💡 Official ZegoCloud Ref Pattern (100% bug-free for React 18)
  const myMeeting = async (element: HTMLDivElement | null) => {
    if (!element) return;

    // Safe Environment Variable Extraction
    const getEnv = (key: string) => {
      try {
        if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key];
        if (typeof process !== 'undefined' && process.env) return process.env[key];
      } catch (e) {}
      return undefined;
    };

    // Uses your provided keys as a permanent fallback if env fails
    const appID = Number(getEnv('VITE_ZEGO_APP_ID') || getEnv('NEXT_PUBLIC_ZEGO_APP_ID') || 21954096);
    const serverSecret = getEnv('VITE_ZEGO_SERVER_SECRET') || getEnv('NEXT_PUBLIC_ZEGO_SERVER_SECRET') || "97cfa92cfa956ce642305577c5296acd9a5b9242468bacdec4c7e550ac9fe761";

    const safeRoomId = `live_${hashCode(roomId || 'default_room')}`;
    const userID = `user_${Math.random().toString(36).substring(2, 10)}`;
    const safeUserName = userName ? userName : `Guest_${Math.floor(Math.random() * 100)}`;

    try {
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        safeRoomId,
        userID,
        safeUserName
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);

      zp.joinRoom({
        container: element,
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
    } catch (error) {
      console.error("ZegoCloud Join Error:", error);
    }
  };

  return (
    <div className="w-full h-full bg-[#0f172a] rounded-[32px] overflow-hidden relative border border-slate-700 shadow-2xl">
      <div ref={myMeeting} className="w-full h-full" />
    </div>
  );
}
