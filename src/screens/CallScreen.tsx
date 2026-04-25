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

  const { title, type, targetId } = location.state || { title: 'Unknown', type: 'audio', targetId: 'unknown' };

  useEffect(() => {
    if (!containerRef.current || !user || targetId === 'unknown') return;

    let zpInstance: any = null;

    const initCall = async () => {
      try {
          const appID = 21954096;
          const serverSecret = "97cfa92cfa956ce642305577c5296acd9a5b92";

          // 1. CRITICAL FIX: Sanitize IDs to strictly alphanumeric & max 16 chars to prevent Zego Token Errors
          const safeUserId = user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
          const safeTargetId = targetId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
          
          // Generate a clean room ID
          const roomID = `room_${[safeUserId, safeTargetId].sort().join('_')}`;
          const userName = user.email ? user.email.split('@')[0] : `User_${safeUserId}`;

          const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
            appID,
            serverSecret,
            roomID,
            safeUserId,
            userName
          );

          zpInstance = ZegoUIKitPrebuilt.create(kitToken);
          
          zpInstance.joinRoom({
            container: containerRef.current,
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
      } catch (error) {
          console.error("ZegoCloud Init Error:", error);
          alert("حدث خطأ في تهيئة المكالمة. يرجى المحاولة مرة أخرى.");
          navigate(-1);
      }
    };

    initCall();

    return () => {
       // 2. CRITICAL FIX: Destroy instance on unmount to release Microphone/Camera locks!
       if (zpInstance) {
           try {
               zpInstance.destroy();
           } catch (e) {
               console.error("Error destroying Zego instance", e);
           }
       }
    };
  }, [user, targetId, type, navigate]);

  return (
    <div className="w-full h-screen bg-[#0f172a] relative">
      <div className="absolute top-4 left-4 z-50">
         <button onClick={() => navigate(-1)} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md transition-colors hover:bg-black/60">
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
