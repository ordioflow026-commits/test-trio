import React, { createContext, useContext, useEffect, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZIM } from 'zego-zim-web';
import { useUser } from './UserContext';

interface ZegoContextType {
  zp: any;
}

const ZegoContext = createContext<ZegoContextType>({ zp: null });

export const useZego = () => useContext(ZegoContext);

export const ZegoProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const [zpInstance, setZpInstance] = useState<any>(null);

  useEffect(() => {
    // 🛡️ ميزة "فك قفل الصوت" لضمان عمل الرنين في المتصفح
    const unlockAudio = () => {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/';
      audio.play().then(() => {
        console.log("Audio Unlocked Success");
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      }).catch(() => {});
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

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

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, '', safeUserId, userName);
      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zp.addPlugins({ ZIM });

      zp.setCallInvitationConfig({
        // 🔔 روابط الرنين العالمية الرسمية والموثوقة
        ringtoneConfig: {
          incomingCallUrl: 'https://storage.zego.im/demo/20220622/incomingCall.mp3',
          outgoingCallUrl: 'https://storage.zego.im/demo/20220622/outgoingCall.mp3'
        },
        
        onIncomingCallReceived: (callID: string, caller: any, callType: number) => {
          const updateTextSafely = () => {
            const elements = document.querySelectorAll('div, span, p');
            elements.forEach(el => {
              if (el.textContent === 'Incoming call...') {
                el.textContent = callType === 1 ? 'مكالمة فيديو... 📹' : 'مكالمة صوتية... 📞';
              }
            });
          };
          updateTextSafely();
          setTimeout(updateTextSafely, 50);
          setTimeout(updateTextSafely, 200);
          setTimeout(updateTextSafely, 500);
        },
        onSetRoomConfigBeforeJoining: (callType: number) => {
          const isVideo = callType === 1; 
          return {
            scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
            turnOnMicrophoneWhenJoining: true,
            turnOnCameraWhenJoining: isVideo,
            showMyCameraToggleButton: isVideo,
            showAudioVideoSettingsButton: isVideo,
          };
        }
      });

      if (isMounted) setZpInstance(zp);
    };

    initZego();

    return () => {
        isMounted = false;
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };
  }, [user]);

  return (
    <ZegoContext.Provider value={{ zp: zpInstance }}>
      {children}
    </ZegoContext.Provider>
  );
};

