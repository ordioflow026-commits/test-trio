import React from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

interface LiveMeetingProps {
  roomId: string;
  userName: string;
}

export default function LiveMeeting({ roomId, userName }: LiveMeetingProps) {

  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  };

  const myMeeting = async (element: HTMLDivElement | null) => {
    if (!element) return;

    const appID = 21954096;
    
    // 🔴 تنبيه هام لكِ: احذفي النص العربي وضعي المفتاح السري الجديد (ServerSecret) بين علامتي التنصيص!
    const serverSecret = "ضعي_مفتاح_SERVER_SECRET_الجديد_هنا"; 

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
