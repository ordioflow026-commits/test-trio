const fs = require('fs');
let content = fs.readFileSync('src/screens/BroadcastScreen.tsx', 'utf8');

// 1. Update LiveStreamViewer config
content = content.replace(
  `        showLeavingView: true,\n        // @ts-ignore\n        showLeaveButton: true,\n        showBottomMenuBar: true,`,
  `        showLeavingView: true,\n        // @ts-ignore\n        showLeaveButton: false,\n        showBottomMenuBar: isHost,`
);

// 2. Update handleLike function
const handleLikeOld = `  const handleLike = async () => {\n    if (!activeStream || !user?.id) return;\n    const currentLikes = activeStream.liked_by || [];\n    if (currentLikes.includes(user.id)) return;\n    \n    const newLikes = [...currentLikes, user.id];\n    \n    setActiveStream({ ...activeStream, liked_by: newLikes });\n    setLiveStreams(prev => prev.map(s => s.id === activeStream.id ? { ...s, liked_by: newLikes } : s));\n    \n    supabase.channel(\`room_\${activeStream.id}\`).send({\n      type: 'broadcast',\n      event: 'like_update',\n      payload: { liked_by: newLikes }\n    });\n    \n    await supabase.from('live_streams').update({ liked_by: newLikes }).eq('id', activeStream.id);\n  };`;

const handleLikeNew = `  const handleLike = async () => {
    if (!activeStream || !user?.id) return;
    const currentLikes = activeStream.liked_by || [];
    // Removed the check so users can like infinitely
    const newLikes = [...currentLikes, user.id];
    
    setActiveStream({ ...activeStream, liked_by: newLikes });
    setLiveStreams(prev => prev.map(s => s.id === activeStream.id ? { ...s, liked_by: newLikes } : s));
    
    supabase.channel(\`room_\${activeStream.id}\`).send({
      type: 'broadcast',
      event: 'like_update',
      payload: { liked_by: newLikes }
    });
    
    await supabase.from('live_streams').update({ liked_by: newLikes }).eq('id', activeStream.id);
  };`;

content = content.replace(handleLikeOld, handleLikeNew);


// 3. Replace roomOverlay
const roomOverlayStartIdx = content.indexOf('  const roomOverlay = (');
const roomOverlayEndStr = `      )}\n    </div>\n  );`;
const roomOverlayEndIdx = content.indexOf(roomOverlayEndStr, roomOverlayStartIdx) + roomOverlayEndStr.length;

const oldRoomOverlay = content.substring(roomOverlayStartIdx, roomOverlayEndIdx);

const newRoomOverlay = `  const roomOverlay = (
    <div 
      className="fixed top-0 left-0 w-screen h-screen z-40 bg-black overflow-hidden flex flex-col" 
      dir={dir}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <style>{\`
        @keyframes gentle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-gentle-float { animation: gentle-float 2.5s ease-in-out infinite; }
      \`}</style>
      
      {!activeStream ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a]">
          <Video className="w-16 h-16 text-slate-600 mb-4" />
          <p className="text-slate-400 font-bold">{dir === 'rtl' ? 'انتهى البث' : 'Stream ended'}</p>
        </div>
      ) : (
        <div className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col relative z-0 animate-in fade-in duration-500">
          
          {/* Base Layer: Content */}
          <div className="absolute inset-0 z-0">
            {activeStream.id.startsWith('mock_') ? (
              <img src={activeStream.image_url} alt={activeStream.topic} className="w-full h-full object-cover opacity-90" />
            ) : (
              <LiveStreamViewer 
                key={activeStream.id} 
                streamId={activeStream.id} 
                isHost={isHost} 
                hostName={activeStream.host_name} 
                onLeave={handleExitRoom} 
              />
            )}
          </div>

          {/* Overlay Layer: Unified UI */}
          <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between">
            
            {/* Top Bar */}
            <div className="w-full p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
              <div className="bg-black/50 backdrop-blur-md rounded-[24px] p-1 pr-3 pl-1 flex items-center gap-2 pointer-events-auto border border-white/10">
                <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                  {activeStream.host_name.charAt(0)}
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-white text-xs font-bold leading-tight">{activeStream.host_name}</span>
                  <span className="text-slate-300 text-[10px] truncate max-w-[100px]">{activeStream.topic}</span>
                </div>
                {activeStream.host_id !== user?.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFollow(activeStream.host_id); }}
                    className={\`ml-1 px-3 py-1 rounded-full text-[10px] font-bold transition-colors \${
                      followedHosts.includes(activeStream.host_id) 
                      ? 'bg-white/20 text-white' 
                      : 'bg-[#f43f5e] text-white'
                    }\`}
                  >
                    {followedHosts.includes(activeStream.host_id) ? (dir === 'rtl' ? 'متابع' : 'Following') : (dir === 'rtl' ? 'متابعة' : 'Follow')}
                  </button>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 pointer-events-auto">
                <div className="flex items-center gap-2">
                   <div className="bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-lg tracking-wider">
                     <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
                   </div>
                   <button onClick={handleExitRoom} className="p-1.5 bg-black/40 hover:bg-red-600 text-white rounded-full transition-colors backdrop-blur-md border border-white/10">
                     <X className="w-4 h-4" />
                   </button>
                </div>
                <div className="bg-black/40 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md flex items-center gap-1.5 border border-white/10 mt-1">
                  <Users className="w-3.5 h-3.5 opacity-80"/> {activeStream.viewers || 0}
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="w-full p-4 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-6">
               <div className="flex justify-end mb-4 pr-1 pointer-events-auto">
                  <div className="flex flex-col items-center gap-1.5 animate-gentle-float">
                     <button 
                       onClick={(e) => { e.stopPropagation(); handleLike(); }} 
                       className="w-11 h-11 rounded-full bg-black/40 border border-white/30 flex items-center justify-center backdrop-blur-md transition-transform active:scale-90"
                     >
                        <Heart className="w-6 h-6 text-white" />
                     </button>
                     <span className="text-white text-[11px] font-bold drop-shadow-md">{likesCount}</span>
                  </div>
               </div>

               <div className="flex items-center gap-3 pointer-events-auto w-full">
                 <div className="flex-1 bg-black/50 border border-white/10 rounded-[24px] px-4 py-3.5 backdrop-blur-md flex items-center">
                   <span className="text-white/60 text-[13px] font-medium">{dir === 'rtl' ? 'إضافة تعليق...' : 'Add comment...'}</span>
                 </div>
                 <button className="w-11 h-11 rounded-full bg-[#2563eb] flex items-center justify-center shadow-lg shrink-0 transition-transform active:scale-95">
                   <Send className="w-4 h-4 text-white ml-0.5" />
                 </button>
                 <button className="w-11 h-11 rounded-full bg-[#f43f5e] flex items-center justify-center shadow-lg shrink-0 transition-transform active:scale-95">
                   <Gift className="w-5 h-5 text-white" />
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );`;

content = content.replace(oldRoomOverlay, newRoomOverlay);

fs.writeFileSync('src/screens/BroadcastScreen.tsx', content);
