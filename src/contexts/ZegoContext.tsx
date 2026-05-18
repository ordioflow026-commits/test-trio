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
    const unlockAudio = () => {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/';
      audio.play().then(() => {
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
      
      // 💡 CRITICAL FIX: ZIM MUST BE ADDED FOR CALL INVITATIONS TO WORK
      zp.addPlugins({ ZIM });

      zp.setCallInvitationConfig({
        ringtoneConfig: {
          incomingCallUrl: 'https://storage.zego.im/demo/20220622/incomingCall.mp3',
          outgoingCallUrl: 'https://storage.zego.im/demo/20220622/outgoingCall.mp3'
        },
        
        onIncomingCallReceived: (callID: string, caller: any, callType: number) => {
          const updateTextSafely = () => {
            const elements = document.querySelectorAll('div, span, p');
            elements.forEach(div => {
              if (div.innerText && (div.innerText.includes('Incoming video call') || div.innerText.includes('Incoming voice call') || div.innerText.includes('مكالمة فيديو واردة') || div.innerText.includes('مكالمة صوتية واردة') || div.innerText.includes('Incoming call...'))) {
                
                const savedLang = localStorage.getItem('language') || 'ar';
                const isAr = savedLang === 'ar';
                const isVideo = callType === 1;
                
                let text = isVideo 
                  ? (isAr ? 'مكالمة فيديو واردة' : 'Incoming Video Call')
                  : (isAr ? 'مكالمة صوتية واردة' : 'Incoming Voice Call');
                  
                let icon = isVideo ? '📹' : '📞';

                div.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; font-family: sans-serif; text-align: center; padding: 15px 10px; width: 100%;">
                    <div style="background: linear-gradient(135deg, #00E5FF 0%, #2563EB 100%); width: 85px; height: 85px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 38px; box-shadow: 0 0 25px rgba(0, 229, 255, 0.6), inset 0 2px 4px rgba(255,255,255,0.3); animation: pulse 2s infinite ease-in-out;">
                      ${icon}
                    </div>
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; text-shadow: 0 4px 12px rgba(0,0,0,0.5); display: block; margin-top: 4px; line-height: 1.2;">
                      ${text}
                    </span>
                    <span style="font-size: 16px; font-weight: 500; color: #94a3b8; opacity: 0.9; text-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                      ${caller.userName || 'TrioSync User'}
                    </span>
                  </div>
                  <style>
                    @keyframes pulse {
                      0% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 229, 255, 0.5); }
                      50% { transform: scale(1.06); box-shadow: 0 0 35px rgba(0, 229, 255, 0.8); }
                      100% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 229, 255, 0.5); }
                    }
                  </style>
                `;
              }
            });
          };
          updateTextSafely();
          setTimeout(updateTextSafely, 30);
          setTimeout(updateTextSafely, 100);
          setTimeout(updateTextSafely, 250);
          setTimeout(updateTextSafely, 600);
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
