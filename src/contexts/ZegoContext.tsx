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
      const appID = 1823159648;
      const serverSecret = "b53364d7eb4f7975c7389248d516e8d8";
      const safeUserId = user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      const userName = user.fullName || (user.email ? user.email.split('@')[0] : `User_${safeUserId}`);

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, '', safeUserId, userName);
      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zp.addPlugins({ ZIM });

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
                
                // 💡 English always, 'Incoming' removed, dots removed
                const forcedEnglishText = isVideo ? 'VIDEO CALL' : 'VOICE CALL';
                
                // 💡 STANDARD, UNIVERSAL UI ICONS (Solid and recognizable)
                const standardVideoSVG = `
                  <svg viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 text-white" style="filter: drop-shadow(0 0 10px rgba(255,255,255,0.6));" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>`;

                const standardPhoneSVG = `
                  <svg viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 text-white" style="filter: drop-shadow(0 0 10px rgba(255,255,255,0.6));" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>`;

                const finalIconSVG = isVideo ? standardVideoSVG : standardPhoneSVG;
                
                el.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; margin-top: 10px; font-family: sans-serif; width: 100%;">
                    
                    <div style="background: linear-gradient(135deg, #00E5FF 0%, #2563EB 100%); width: 85px; height: 85px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px rgba(0, 229, 255, 0.7); animation: zegoPulseClean 2s infinite ease-in-out;">
                      ${finalIconSVG}
                    </div>

                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 1px; text-shadow: 0 4px 12px rgba(0,0,0,0.6); text-align: center; display: block; margin-top: 4px; line-height: 1.2;">
                      ${forcedEnglishText}
                    </span>
                  </div>
                  <style>
                    @keyframes zegoPulseClean {
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
          setTimeout(updateTextSafely, 50);
          setTimeout(updateTextSafely, 200);
          setTimeout(updateTextSafely, 500);
          setTimeout(updateTextSafely, 800);
        },
        
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
