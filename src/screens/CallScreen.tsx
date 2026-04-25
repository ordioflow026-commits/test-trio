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
  
  // 1. CRITICAL FIX: Navigation Lock to prevent jumping back 2 screens
  const hasNavigated = useRef(false);

  const { title, type, targetId } = location.state || { title: 'Unknown', type: 'audio', targetId: 'unknown' };

  // Centralized exit function to ensure hardware is released and we only navigate ONCE
  const goBack = () => {
      if (!hasNavigated.current) {
          hasNavigated.current = true;
          if (zpRef.current) {
              try {
                  zpRef.current.destroy();
                  zpRef.current = null;
              } catch (e) {
                  console.error("Destruction error on exit", e);
              }
          }
          navigate(-1);
      }
  };

  useEffect(() => {
    if (!containerRef.current || !user) return;

    const initCall = async () => {
      try {
          const appID = 21954096;
          const serverSecret = "97cfa92cfa956ce642305577c5296acd9a5b92";

          // 2. CRITICAL FIX: Fallback to prevent Null exceptions on replace()
          const safeUserId = (user?.id || 'u').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
          const safeTargetId = (targetId || 't').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
          
          const roomID = `room_${[safeUserId, safeTargetId].sort().join('_')}`;
          const userName = user.email ? user.email.split('@')[0] : `User_${safeUserId}`;

          const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
            appID, serverSecret, roomID, safeUserId, userName
          );

          if (zpRef.current) {
              zpRef.current.destroy();
          }

          zpRef.current = ZegoUIKitPrebuilt.create(kitToken);
          
          zpRef.current.joinRoom({
            container: containerRef.current,
            scenario: {
              mode: ZegoUIKitPrebuilt.OneONoneCall,
            },
            turnOnMicrophoneWhenJoining: true,
            turnOnCameraWhenJoining: type === 'video',
            showPreJoinView: false,
            onLeaveRoom: () => {
              goBack(); // Uses the safe exit function
            },
          });
      } catch (error) {
          console.error("ZegoCloud Init Error:", error);
          goBack();
      }
    };

    initCall();

    return () => {
       // Cleanup on unmount if user swipes back manually
       if (zpRef.current && !hasNavigated.current) {
           try {
               zpRef.current.destroy();
               zpRef.current = null;
           } catch (e) {
               console.error("Cleanup error", e);
           }
       }
    };
  }, [user, targetId, type]);

  return (
    <div className="w-full h-screen bg-[#0f172a] relative">
      <div className="absolute top-4 left-4 z-50">
         <button onClick={goBack} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md transition-colors hover:bg-black/60">
            <ArrowLeft className="w-6 h-6" />
         </button>
      </div>
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
         <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-300 font-medium">جاري تهيئة الاتصال المشفّر...</span>
         </div>
      </div>
    </div>
  );
}
