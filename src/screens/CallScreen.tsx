import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useUser } from '../contexts/UserContext';
import { ArrowLeft } from 'lucide-react';

export default function CallScreen() {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const { title, type, targetId } = location.state || { title: 'Unknown', type: 'audio', targetId: 'unknown' };

  // Official ZegoCloud Pattern: Callback Ref
  const myMeeting = async (element: HTMLDivElement | null) => {
    if (!element || !user || targetId === 'unknown') return;

    try {
      const appID = 21954096;
      const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4";

      const safeUserId = (user?.id || 'u').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      const safeTargetId = (targetId || 't').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      const roomID = `room_${[safeUserId, safeTargetId].sort().join('_')}`;
      const userName = user.email ? user.email.split('@')[0] : `User_${safeUserId}`;

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID, serverSecret, roomID, safeUserId, userName
      );

      // Ensure container is empty before injection
      element.innerHTML = '';

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      
      zp.joinRoom({
        container: element,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: type === 'video',
        showPreJoinView: false,
        onLeaveRoom: () => {
          navigate(-1);
        },
      });
    } catch (err) {
      console.error("Zego Rendering Error:", err);
      navigate(-1);
    }
  };

  return (
    <div className="w-full h-screen bg-[#0f172a] relative overflow-hidden">
      <div className="absolute top-4 left-4 z-50">
         <button onClick={() => navigate(-1)} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md transition-colors hover:bg-black/60 shadow-lg">
            <ArrowLeft className="w-6 h-6" />
         </button>
      </div>
      
      {/* Callback Ref attached directly to the visual container */}
      <div ref={myMeeting} className="w-full h-full" />
    </div>
  );
}
