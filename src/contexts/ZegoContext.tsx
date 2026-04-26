import React, { createContext, useContext, useEffect, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZIM } from 'zego-zim-web';
import { useUser } from './UserContext';
import { Video, Phone, Check, X } from 'lucide-react';

interface ZegoContextType {
  zp: any;
}

const ZegoContext = createContext<ZegoContextType>({ zp: null });

export const useZego = () => useContext(ZegoContext);

export const ZegoProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const [zpInstance, setZpInstance] = useState<any>(null); // CRITICAL: Use State, not Ref!
  const [incomingCall, setIncomingCall] = useState<{callID: string, caller: any, callType: number} | null>(null);

  useEffect(() => {
    if (!user || !user.id) {
      if (zpInstance) {
          zpInstance.destroy();
          setZpInstance(null);
      }
      return;
    }

    let isMounted = true;

    const initZego = async () => {
        const appID = 21954096;
        const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4";

        const safeUserId = user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        const userName = user.fullName || (user.email ? user.email.split('@')[0] : `User_${safeUserId}`);

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID, serverSecret, '', safeUserId, userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zp.addPlugins({ ZIM });

        zp.setCallInvitationConfig({
          enableCustomCallInvitationDialog: true,
          onIncomingCallReceived: (callID: string, caller: any, callType: number, callees: any[]) => {
            setIncomingCall({ callID, caller, callType });
          },
          onIncomingCallCanceled: () => {
            setIncomingCall(null);
          },
          onCallInvitationEnded: () => {
            setIncomingCall(null);
          },
          onSetRoomConfigBeforeJoining: (callType: number) => {
            const isVideo = callType === 1; 
            return {
              scenario: {
                mode: ZegoUIKitPrebuilt.OneONoneCall,
              },
              turnOnMicrophoneWhenJoining: true,
              turnOnCameraWhenJoining: isVideo,
              showMyCameraToggleButton: isVideo,
              showAudioVideoSettingsButton: isVideo,
            };
          }
        });

        if (isMounted) {
            setZpInstance(zp); // Trigger re-render to provide 'zp' to app
        }
    };

    initZego();

    return () => {
        isMounted = false;
    };
  }, [user]);

  const handleAccept = () => {
    if (zpInstance && incomingCall) {
      zpInstance.acceptCallInvitation(incomingCall.callID);
      setIncomingCall(null);
    }
  }

  const handleReject = () => {
    if (zpInstance && incomingCall) {
      zpInstance.rejectCallInvitation(incomingCall.callID);
      setIncomingCall(null);
    }
  }

  return (
    <ZegoContext.Provider value={{ zp: zpInstance }}>
      {children}
      {incomingCall && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm border border-slate-700/50 flex flex-col pt-8 pb-6 px-6 relative items-center text-center animate-in zoom-in-95 duration-300">
            {incomingCall.callType === 1 ? (
              <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-4">
                <Video className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4">
                <Phone className="w-8 h-8" />
              </div>
            )}
            
            <h3 className="text-xl font-bold text-white mb-2">
              {incomingCall.caller.userName || 'مستخدم غير معروف'}
            </h3>
            <p className="text-slate-300 mb-8 font-medium">
              يدعوك إلى {incomingCall.callType === 1 ? 'مكالمة فيديو 📹' : 'مكالمة صوتية 📞'}
            </p>
            
            <div className="flex gap-6 justify-center w-full">
              <button 
                onClick={handleReject}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 group-hover:bg-red-600 group-hover:scale-105 transition-all">
                  <X className="w-6 h-6" strokeWidth={2.5}/>
                </div>
                <span className="text-red-400 font-medium text-sm">رفض</span>
              </button>
              
              <button 
                onClick={handleAccept}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30 group-hover:bg-green-600 group-hover:scale-105 transition-all">
                  <Check className="w-6 h-6" strokeWidth={2.5}/>
                </div>
                <span className="text-green-400 font-medium text-sm">قبول</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ZegoContext.Provider>
  );
};
