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
  const hasNavigated = useRef(false);

  const { title, type, targetId } = location.state || { title: 'Unknown', type: 'audio', targetId: 'unknown' };

  useEffect(() => {
    if (!containerRef.current || !user || targetId === 'unknown') return;

    let isMounted = true; // Strict Mode & Async Protection
    let zpInstance: any = null;

    const initCall = async () => {
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

          if (!isMounted) return; // Prevent Ghost connection

          zpInstance = ZegoUIKitPrebuilt.create(kitToken);
          
          if (!isMounted) {
              zpInstance.destroy();
              return;
          }

          zpInstance.joinRoom({
            container: containerRef.current, // Now points to an EMPTY div
            scenario: {
              mode: ZegoUIKitPrebuilt.OneONoneCall,
            },
            turnOnMicrophoneWhenJoining: true,
            turnOnCameraWhenJoining: type === 'video',
            showPreJoinView: false,
            onLeaveRoom: () => {
              if (!hasNavigated.current) {
                  hasNavigated.current = true;
                  if (zpInstance) zpInstance.destroy();
                  navigate(-1);
              }
            },
          });
      } catch (error) {
          console.error("ZegoCloud Init Error:", error);
          if (!hasNavigated.current && isMounted) {
              hasNavigated.current = true;
              navigate(-1);
          }
      }
    };

    initCall();

    return () => {
       isMounted = false; // Mark component as dead
       if (zpInstance) {
           try {
               zpInstance.destroy(); // CRITICAL: Release OS Microphone/Camera
           } catch (e) {
               console.error("Cleanup error", e);
           }
       }
    };
  }, [user, targetId, type, navigate]);

  return (
    <div className="w-full h-screen bg-[#0f172a] relative overflow-hidden">
      <div className="absolute top-4 left-4 z-50">
         <button onClick={() => {
             if (!hasNavigated.current) {
                 hasNavigated.current = true;
                 navigate(-1);
             }
         }} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md transition-colors hover:bg-black/60 shadow-lg">
            <ArrowLeft className="w-6 h-6" />
         </button>
      </div>
      
      {/* Loading Layer (Behind ZegoCloud) */}
      <div className="absolute inset-0 flex items-center justify-center z-0">
         <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-300 font-medium">جاري تهيئة الاتصال المشفّر...</span>
         </div>
      </div>

      {/* ZegoCloud Container (On Top - MUST REMAIN EMPTY FOR ZEGO TO INJECT) */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-10" />
    </div>
  );
}
