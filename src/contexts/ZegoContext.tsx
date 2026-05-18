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
                
                // 💡 3D REALISTIC SVG - Video Camera with Depth
                const realisticVideoSVG = `
                  <svg viewBox="0 0 100 100" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)) contrast(1.1);">
                    <defs>
                      <linearGradient id="real_cam_gradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
                        <stop offset="100%" stop-color="#a3e635" stop-opacity="0.9" />
                      </linearGradient>
                      <radialGradient id="real_lens_gradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#2563EB" />
                        <stop offset="70%" stop-color="#00E5FF" />
                        <stop offset="100%" stop-color="#0F172A" />
                      </radialGradient>
                    </defs>
                    <rect x="15" y="25" width="55" height="50" rx="8" fill="url(#real_cam_gradient)" stroke="#0F172A" strokeWidth="1"/>
                    <circle cx="35" cy="50" r="15" fill="url(#real_lens_gradient)" stroke="#ffffff" strokeWidth="2.5"/>
                    <circle cx="35" cy="50" r="10" fill="#a3e635" opacity="0.3"/>
                    <rect x="25" y="15" width="35" height="10" rx="4" fill="url(#real_cam_gradient)" stroke="#0F172A" strokeWidth="1"/>
                    <path d="M 70 40 L 85 30 L 85 70 L 70 60 Z" fill="url(#real_cam_gradient)" stroke="#0F172A" strokeWidth="1" strokeLinejoin="round"/>
                    <ellipse cx="85" cy="50" r="6" ry="18" fill="url(#real_cam_gradient)" stroke="#0F172A" strokeWidth="1"/>
                  </svg>`;

                // 💡 3D REALISTIC SVG - Phone Handset with Depth
                const realisticPhoneSVG = `
                  <svg viewBox="0 0 100 100" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)) contrast(1.1);">
                    <defs>
                      <linearGradient id="real_phone_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
                        <stop offset="100%" stop-color="#d1d5db" stop-opacity="0.9" />
                      </linearGradient>
                    </defs>
                    <path d="M 15 25 C 15 15, 85 15, 85 25 L 85 75 C 85 85, 15 85, 15 75 Z" fill="url(#real_phone_gradient)" stroke="#0F172A" strokeWidth="1.5"/>
                    <ellipse cx="50" cy="72" r="15" ry="8" fill="#d1d5db" stroke="#0F172A" strokeWidth="1.5"/>
                    <circle cx="50" cy="72" r="2.5" fill="#0F172A"/>
                    <ellipse cx="50" cy="28" r="15" ry="8" fill="#d1d5db" stroke="#0F172A" strokeWidth="1.5"/>
                    <circle cx="50" cy="28" r="3" fill="#0F172A"/>
                    <g stroke="#2563EB" strokeWidth="3" fill="none" transform="scale(0.35) translate(100,80)">
                      <path d="M 43 55 L 43 22 A 7 7 0 0 1 57 22 L 57 45" />
                      <path d="M 43 55 L 43 22 A 7 7 0 0 1 57 22 L 57 45" transform="rotate(120 50 50)" />
                      <path d="M 43 55 L 43 22 A 7 7 0 0 1 57 22 L 57 45" transform="rotate(240 50 50)" />
                    </g>
                  </svg>`;

                const finalIconSVG = isVideo ? realisticVideoSVG : realisticPhoneSVG;
                
                // 💡 Oversized Glowing UI Injection with Depth
                el.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; margin-top: 12px; font-family: sans-serif; width: 100%;">
                    
                    <div style="background: linear-gradient(135deg, #00E5FF 0%, #2563EB 100%); width: 85px; height: 85px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px rgba(0, 229, 255, 0.7), inset 0 3px 5px rgba(0,0,0,0.3); animation: zegoRealisticPulse 2s infinite ease-in-out; border: 3px solid rgba(255,255,255,0.4);">
                      ${finalIconSVG}
                    </div>

                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 1px; text-shadow: 0 4px 12px rgba(0,0,0,0.6); text-align: center; display: block; margin-top: 4px; line-height: 1.2;">
                      ${forcedEnglishText}
                    </span>
                  </div>
                  <style>
                    @keyframes zegoRealisticPulse {
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
