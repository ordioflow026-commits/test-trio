import React, { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useUser } from '../contexts/UserContext';
import { ArrowLeft } from 'lucide-react';

export default function CallScreen() {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const hasNavigated = useRef(false);

  const { title, type, targetId } = location.state || { title: 'Unknown', type: 'audio', targetId: 'unknown' };

  const goBack = () => {
      if (!hasNavigated.current) {
          hasNavigated.current = true;
          if (zpRef.current) {
              try {
                  zpRef.current.destroy();
                  zpRef.current = null;
              } catch(e) {
                  console.error("Cleanup error:", e);
              }
          }
          navigate(-1);
      }
  };

  useEffect(() => {
    if (!containerRef.current || !user || targetId === 'unknown') return;

    let isMounted = true;

    const initCall = async () => {
      try {
          const appID = 21954096;
          const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4"; // Verified correct Web Secret

          const safeUserId = (user?.id || 'u').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
          const safeTargetId = (targetId || 't').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
          const roomID = `room_${[safeUserId, safeTargetId].sort().join('_')}`;
          const userName = user.email ? user.email.split('@')[0] : `User_${safeUserId}`;

          const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
            appID, serverSecret, roomID, safeUserId, userName
          );

          if (!isMounted) return; // Prevent Strict Mode Ghost Mounting

          const zp = ZegoUIKitPrebuilt.create(kitToken);
          zpRef.current = zp;
          
          const isVideo = type === 'video';

          zp.joinRoom({
            container: containerRef.current,
            scenario: {
              mode: ZegoUIKitPrebuilt.OneONoneCall,
            },
            turnOnMicrophoneWhenJoining: true,
            turnOnCameraWhenJoining: isVideo, // False for Audio
            showMyCameraToggleButton: isVideo, // CRITICAL: Completely hide camera button in audio calls
            showAudioVideoSettingsButton: isVideo, // CRITICAL: Prevent camera access request in audio calls
            showScreenSharingButton: false,
            showPreJoinView: false,
            onLeaveRoom: () => {
              goBack();
            },
          });
      } catch (err) {
        console.error("Zego Init Error:", err);
        goBack();
      }
    };

    initCall();

    return () => {
       isMounted = false;
       if (zpRef.current && !hasNavigated.current) {
           try {
               zpRef.current.destroy(); // Hardware unlock
               zpRef.current = null;
           } catch (e) {}
       }
    };
  }, [user, targetId, type]);

  return (
    <div className="w-full h-screen bg-[#0f172a] relative overflow-hidden">
      <div className="absolute top-4 left-4 z-50">
         <button onClick={goBack} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md transition-colors hover:bg-black/60 shadow-lg">
            <ArrowLeft className="w-6 h-6" />
         </button>
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
