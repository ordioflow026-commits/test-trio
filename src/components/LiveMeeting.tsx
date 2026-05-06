import React, { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

interface LiveMeetingProps {
  roomId: string;
  userName: string;
}

export default function LiveMeeting({ roomId, userName }: LiveMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const hasAttempted = useRef(false);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
    console.log(msg);
  };

  useEffect(() => {
    // Prevent React 18 Strict Mode double-execution
    if (hasAttempted.current) return;
    hasAttempted.current = true;
    let zp: any = null;

    const startMeeting = async () => {
      try {
        addLog("⏳ 1. Starting ZegoCloud initialization...");
        
        // Hardcoding keys for diagnostic purity (bypassing any Vite .env issues)
        const appID = 21954096;
        const serverSecret = "97cfa92cfa956ce642305577c5296acd9a5b9242468bacdec4c7e550ac9fe761";
        
        addLog(`✅ 2. Keys loaded | AppID type: ${typeof appID} | Secret length: ${serverSecret.length}`);

        const safeRoomId = "testroom" + Math.floor(Math.random() * 1000);
        const safeUserId = "user_" + Math.floor(Math.random() * 100000);
        const safeUserName = "Guest_" + Math.floor(Math.random() * 1000);

        addLog(`✅ 3. Data sanitized | Room: ${safeRoomId} | User: ${safeUserName}`);
        addLog("⏳ 4. Generating Token...");

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          safeRoomId,
          safeUserId,
          safeUserName
        );

        addLog("✅ 5. Token generated successfully!");
        addLog("⏳ 6. Creating Zego Instance...");

        zp = ZegoUIKitPrebuilt.create(kitToken);

        addLog("✅ 7. Instance created! Sending joinRoom command...");

        if (!containerRef.current) {
           throw new Error("Container DOM element is missing!");
        }

        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.VideoConference,
          },
          showPreJoinView: false,
          showUserList: false,
        });

        addLog("🚀 8. joinRoom executed. Waiting for Zego UI...");

      } catch (error: any) {
        addLog(`❌ CRITICAL ERROR CAUGHT:`);
        addLog(`Message: ${error.message || JSON.stringify(error)}`);
        if (error.stack) addLog(`Stack: ${error.stack.substring(0, 150)}...`);
      }
    };

    startMeeting();

    return () => {
      if (zp) {
        addLog("🧹 Cleanup: Destroying instance.");
        zp.destroy();
      }
    };
  }, []); // Empty dependency array

  return (
    <div className="w-full h-full bg-slate-900 rounded-[32px] overflow-hidden relative border border-slate-700 shadow-2xl">
      {/* Zego UI Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />
      
      {/* Diagnostic Overlay */}
      <div className="absolute inset-0 z-50 bg-black/80 p-4 overflow-y-auto pointer-events-none">
        <h3 className="text-cyan-400 font-bold mb-4 border-b border-cyan-800 pb-2">ZegoCloud Diagnostic Tracker:</h3>
        <div className="flex flex-col gap-2 font-mono text-[10px] sm:text-xs text-green-400" dir="ltr">
          {logs.map((log, idx) => (
            <span key={idx} className={log.includes('❌') ? 'text-red-500 font-bold' : ''}>
              {log}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
