import React, { createContext, useContext, useEffect, useRef } from 'react';
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
  const zpRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      if (zpRef.current) {
        // Logout maybe or destroy?
      }
      return;
    }

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
        incomingCallUrl: 'https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg',
        outgoingCallUrl: 'https://actions.google.com/sounds/v1/alarms/dialing_telephone_ring.ogg',
      },
      onSetRoomConfigBeforeJoining: (callType: number) => {
        const isVideo = callType === 1; // 1 for Video Call
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

    zpRef.current = zp;

  }, [user]);

  return (
    <ZegoContext.Provider value={{ zp: zpRef.current }}>
      {children}
    </ZegoContext.Provider>
  );
};
