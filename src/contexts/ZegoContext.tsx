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

      // 💡 Restored 'global_lobby' to match the exact setup when it was working perfectly
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, 'global_lobby', safeUserId, userName);
      const zp = ZegoUIKitPrebuilt.create(kitToken);
      
      zp.addPlugins({ ZIM });

      zp.setCallInvitationConfig({
        ringtoneConfig: {
          incomingCallUrl: 'https://storage.zego.im/demo/20220622/incomingCall.mp3',
          outgoingCallUrl: 'https://storage.zego.im/demo/20220622/outgoingCall.mp3'
        },
        
        onIncomingCallReceived: (callID: string, caller: any, callType: number) => {
          const styleZegoPopupSafely = () => {
            const allElements = document.querySelectorAll('div, span, p, h1, h2');
            
            allElements.forEach((el: any) => {
              // 1. Safe text mutation - ALWAYS English, NO dots, GIANT font size
              if (el.innerText && (
                el.innerText.includes('Incoming video call') || 
                el.innerText.includes('Incoming voice call') ||
                el.innerText.includes('مكالمة فيديو واردة') ||
                el.innerText.includes('مكالمة صوتية واردة') ||
                el.innerText.includes('Incoming call')
              )) {
                const isVideo = callType === 1;
                const forcedEnglishText = isVideo ? 'Incoming Video Call' : 'Incoming Voice Call';
                
                // Target only the immediate text node wrapper to preserve buttons below it
                if (el.children.length === 0 || (el.children.length === 1 && el.children[0].tagName === 'B')) {
                  el.textContent = forcedEnglishText;
                  el.style.fontSize = '32px';
                  el.style.fontWeight = '900';
                  el.style.color = '#ffffff';
                  el.style.display = 'block';
                  el.style.lineHeight = '1.2';
                  el.style.letterSpacing = '0.5px';
                  el.style.textShadow = '0 4px 14px rgba(0,0,0,0.7)';
                  el.style.marginTop = '8px';
                  el.style.marginBottom = '4px';
                }
              }
              
              // 2. Safe Avatar Circle mutation - Bigger ring and luminous cyan glow
              if (el.style && (el.style.borderRadius === '50%' || el.style.width === '40px' || el.style.width === '48px') && !el.innerText.includes('📹') && !el.innerText.includes('📞')) {
                el.style.width = '85px';
                el.style.height = '85px';
                el.style.background = 'linear-gradient(135deg, #00E5FF 0%, #2563EB 100%)';
                el.style.boxShadow = '0 0 25px rgba(0, 229, 255, 0.7), inset 0 2px 4px rgba(255,255,255,0.3)';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.fontSize = '38px';
                el.style.margin = '0 auto';
                el.style.animation = 'trioCallPulse 2s infinite ease-in-out';
                
                // Inject dynamic emoji icon if empty
                if (!el.innerHTML.trim() || el.innerHTML.length < 5) {
                  el.innerHTML = callType === 1 ? '📹' : '📞';
                }
              }
            });
          };

          // Inject global animation stylesheet safely if it doesn't exist
          if (!document.getElementById('trio-call-animation')) {
            const style = document.createElement('style');
            style.id = 'trio-call-animation';
            style.innerHTML = `
              @keyframes trioCallPulse {
                0% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 229, 255, 0.5); }
                50% { transform: scale(1.06); box-shadow: 0 0 35px rgba(0, 229, 255, 0.8); }
                100% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 229, 255, 0.5); }
              }
            `;
            document.head.appendChild(style);
          }

          // Multi-stage safe rendering lock loop
          styleZegoPopupSafely();
          setTimeout(styleZegoPopupSafely, 30);
          setTimeout(styleZegoPopupSafely, 120);
          setTimeout(styleZegoPopupSafely, 300);
          setTimeout(styleZegoPopupSafely, 600);
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
