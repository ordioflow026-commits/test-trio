import React, { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useUser } from '../contexts/UserContext';

export default function CallScreen() {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract call parameters from navigation state
  const { title, type, targetId } = location.state || { title: 'Unknown', type: 'audio', targetId: 'unknown' };

  useEffect(() => {
    if (!containerRef.current || !user || targetId === 'unknown') return;

    const initCall = async () => {
      // ZegoCloud Credentials
      const appID = 21954096;
      const serverSecret = "97cfa92cfa956ce642305577c5296acd9a5b92";

      // Generate a strictly unique and identical room ID for both users
      const roomID = `room_${[user.id, targetId].sort().join('_')}`;
      const userID = user.id;
      const userName = user.email ? user.email.split('@')[0] : `User_${userID.substring(0, 4)}`;

      // Generate Kit Token
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomID,
        userID,
        userName
      );

      // Initialize ZegoCloud instance
      const zp = ZegoUIKitPrebuilt.create(kitToken);
      
      zp.joinRoom({
        container: containerRef.current,
        sharedLinks: [
          {
            name: 'Copy link',
            url: window.location.origin + window.location.pathname + '?roomID=' + roomID,
          },
        ],
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
    };

    initCall();

    // Cleanup function is handled automatically by ZegoCloud instance upon leaving
  }, [user, targetId, type, navigate]);

  return (
    <div className="w-full h-screen bg-[#0f172a] relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
