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
  const [zpInstance, setZpInstance] = useState<any>(null); // CRITICAL: Use State, not Ref!

  useEffect(() => {
    if (!user) {
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

        const safeUserId = (user?.id || 'u').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        const userName = user.fullName || (user.email ? user.email.split('@')[0] : `User_${safeUserId}`);

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID, serverSecret, 'global_ring', safeUserId, userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zp.addPlugins({ ZIM });

        zp.setCallInvitationConfig({
          ringtoneConfig: {
            incomingCallUrl: 'https://unpkg.com/@zegocloud/zego-uikit-prebuilt/zego-incoming.mp3',
            outgoingCallUrl: 'https://unpkg.com/@zegocloud/zego-uikit-prebuilt/zego-outgoing.mp3',
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

  return (
    <ZegoContext.Provider value={{ zp: zpInstance }}>
      {children}
    </ZegoContext.Provider>
  );
};
