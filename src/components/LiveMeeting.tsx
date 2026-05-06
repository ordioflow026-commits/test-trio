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
    
    // 🔴 USER: PASTE YOUR 32-CHARACTER SERVER SECRET HERE:
    const serverSecret = "PASTE_YOUR_32_CHAR_SERVER_SECRET_HERE"; 

    // 💡 Smart Validation: Prevents the 1002011 Token Decryption Error
    if (serverSecret.length !== 32) {
      element.innerHTML = `
        <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0f172a; color:white; padding:20px; text-align:center; font-family:sans-serif;" dir="rtl">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin-bottom:16px;">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 style="color:#ef4444; margin-bottom:8px; font-weight:bold;">خطأ: المفتاح غير صالح (السبب الحقيقي لخطأ 1002011)</h3>
          <p style="color:#94a3b8; font-size:14px; line-height:1.6;">المفتاح الذي وضعته يتكون من <b>${serverSecret.length}</b> حرفاً.<br/>أنتِ تستخدمين مفتاح <b style="color:#facc15">AppSign</b> الطويل بالخطأ، مما يسبب فشل السيرفر في فك التشفير.</p>
          <p style="color:#e2e8f0; font-size:14px; margin-top:12px; padding:12px; background:#1e293b; border-radius:8px;">يرجى العودة لموقع ZegoCloud، وتجاهل AppSign تماماً.<br/>انسخي مفتاح <b style="color:#38bdf8">ServerSecret</b> (يجب أن يكون 32 حرفاً فقط) وضعيه في الكود.</p>
        </div>
      `;
      return;
    }

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
