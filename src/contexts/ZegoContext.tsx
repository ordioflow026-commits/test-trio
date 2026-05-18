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
      zp.addPlugins({ ZIM });

      // 💡 دالة إيقاف الرنين
      const stopRingtone = () => {
        const audio = document.getElementById('trio-ringtone') as HTMLAudioElement;
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      };

      zp.setCallInvitationConfig({
        ringtoneConfig: {
          incomingCallUrl: 'https://storage.zego.im/demo/20220622/incomingCall.mp3',
          outgoingCallUrl: 'https://storage.zego.im/demo/20220622/outgoingCall.mp3'
        },
        
        onIncomingCallReceived: (callID: string, caller: any, callType: number) => {
          // 💡 إجبار تشغيل الرنين
          let audio = document.getElementById('trio-ringtone') as HTMLAudioElement;
          if (!audio) {
            audio = new Audio('https://storage.zego.im/demo/20220622/incomingCall.mp3');
            audio.id = 'trio-ringtone';
            audio.loop = true;
            document.body.appendChild(audio);
          }
          audio.play().catch(() => console.log('Autoplay blocked by browser'));

          const updateTextSafely = () => {
            const elements = document.querySelectorAll('div, span, p');
            elements.forEach(el => {
              if (el.textContent === 'Incoming call...') {
                const isVideo = callType === 1;
                const forcedEnglishText = isVideo ? 'VIDEO CALL' : 'VOICE CALL';
                
                const phoneSVG = `<svg viewBox="0 0 24 24" fill="none" class="w-12 h-12 text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" xmlns="http://www.w3.org/2000/svg"><path d="M11 5L15 9M11 5V21M11 5L7 9M11 21L7 17M11 21L15 17" stroke="url(#app_icon_gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>`;
                const videoSVG = `<svg viewBox="0 0 24 24" fill="none" class="w-12 h-12 text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" xmlns="http://www.w3.org/2000/svg"><path d="M15 10L19.5528 7.72361C19.8273 7.58635 20.1332 7.69755 20.2631 7.9621C20.2974 8.03217 20.3116 8.10904 20.3045 8.18579L19.7891 13.8055C19.7431 14.3013 19.3486 14.6853 18.8509 14.7176L15.3562 14.9427C15.1328 14.9571 14.9221 14.8519 14.8211 14.6501V11.2332C14.8211 10.9701 14.881 10.7077 15 10Z" stroke="url(#app_icon_gradient)" strokeWidth="1.5"/><path d="M12 18H4C2.89543 18 2 17.1046 2 16V8C2 6.89543 2.89543 6 4 6H12C13.1046 6 14 6.89543 14 8V16C14 17.1046 13.1046 18 12 18Z" stroke="url(#app_icon_gradient)" strokeWidth="1.5"/><path d="M7 15V9" stroke="url(#app_icon_gradient)" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 12V10M5 12V10" stroke="url(#app_icon_gradient)" strokeWidth="1.5" strokeLinecap="round"/></svg>`;

                const finalIconSVG = isVideo ? videoSVG : phoneSVG;
                
                el.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; margin-top: 10px; font-family: sans-serif; width: 100%;">
                    <div style="background: linear-gradient(135deg, #00E5FF 0%, #2563EB 100%); width: 85px; height: 85px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 38px; box-shadow: 0 0 25px rgba(0, 229, 255, 0.6), inset 0 2px 4px rgba(255,255,255,0.3); animation: pulseZegoPulse 2s infinite ease-in-out;">
                      ${finalIconSVG}
                    </div>
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 1px; text-shadow: 0 4px 12px rgba(0,0,0,0.6); text-align: center; display: block; margin-top: 4px; line-height: 1.2;">
                      ${forcedEnglishText}
                    </span>
                  </div>
                  <style>
                    @keyframes pulseZegoPulse {
                      0% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 229, 255, 0.5); }
                      50% { transform: scale(1.06); box-shadow: 0 0 35px rgba(0, 229, 255, 0.8); }
                      100% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 229, 255, 0.5); }
                    }
                  </style>
                  <svg width="0" height="0">
                    <defs>
                      <linearGradient id="app_icon_gradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
                        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.6" />
                      </linearGradient>
                    </defs>
                  </svg>
                `;
              }
            });
          };
          updateTextSafely();
          setTimeout(updateTextSafely, 50);
          setTimeout(updateTextSafely, 200);
          setTimeout(updateTextSafely, 500);
          setTimeout(updateTextSafely, 800);
        },
        
        // 💡 إيقاف الرنين عند انتهاء أو قبول أو رفض المكالمة
        onIncomingCallCanceled: stopRingtone,
        onIncomingCallAcceptButtonPressed: stopRingtone,
        onIncomingCallDeclineButtonPressed: stopRingtone,
        onIncomingCallTimeout: stopRingtone,

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
