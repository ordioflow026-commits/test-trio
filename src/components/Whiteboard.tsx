import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WhiteboardProps {
  roomId?: string;
  canInteract?: boolean;
}

export default function Whiteboard({ roomId, canInteract = true }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#00b4d8');
  const channelRef = useRef<any>(null);
  const lastPos = useRef<{ x: number, y: number } | null>(null);
  
  // 💡 إضافة متغيرات التحكم في سرعة الإرسال (Throttling)
  const lastEmitTime = useRef<number>(0);
  const THROTTLE_MS = 30; // إرسال التحديثات كل 30 ملي ثانية كحد أقصى

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`whiteboard_${roomId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'draw' }, (payload) => {
      const { x0, y0, x1, y1, color: c, clear } = payload.payload;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      if (clear) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.beginPath();
      ctx.strokeStyle = c;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
      ctx.lineTo(x1 * canvas.width, y1 * canvas.height);
      ctx.stroke();
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Save current drawing
        const ctx = canvas.getContext('2d');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

        // Resize canvas
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Restore drawing scaled to new size
        if (ctx) ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      }
    };

    // Initial setup
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canInteract || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (lastPos.current) {
      // 1. الرسم المحلي (يحدث دائماً وبنعومة تامة)
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      // 2. البث الشبكي (يحدث فقط إذا مرت المدة المحددة لتخفيف الضغط)
      const now = Date.now();
      if (now - lastEmitTime.current >= THROTTLE_MS) {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'draw',
            payload: {
              x0: lastPos.current.x / canvas.width,
              y0: lastPos.current.y / canvas.height,
              x1: x / canvas.width,
              y1: y / canvas.height,
              color
            }
          });
        }
        lastEmitTime.current = now;
      }
    }
    lastPos.current = { x, y };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canInteract) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    lastPos.current = { x: clientX - rect.left, y: clientY - rect.top };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearBoard = () => {
    if (!canInteract || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'draw', payload: { clear: true } });
    }
  };

  return (
    <div className="w-full h-full bg-slate-900 rounded-[32px] border border-slate-700/50 shadow-2xl relative overflow-hidden flex flex-col">
      {canInteract && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#00b4d8]/40 shadow-[0_4px_12px_rgba(0,0,0,0.3)] flex items-center gap-3 z-[60]">
          <button onClick={() => setColor('#00b4d8')} className={`w-6 h-6 rounded-full bg-[#00b4d8] ${color === '#00b4d8' ? 'ring-2 ring-white scale-110' : ''}`} />
          <button onClick={() => setColor('#ef4444')} className={`w-6 h-6 rounded-full bg-red-500 ${color === '#ef4444' ? 'ring-2 ring-white scale-110' : ''}`} />
          <button onClick={() => setColor('#22c55e')} className={`w-6 h-6 rounded-full bg-green-500 ${color === '#22c55e' ? 'ring-2 ring-white scale-110' : ''}`} />
          <button onClick={() => setColor('#eab308')} className={`w-6 h-6 rounded-full bg-yellow-500 ${color === '#eab308' ? 'ring-2 ring-white scale-110' : ''}`} />
          <div className="w-px h-6 bg-slate-600 mx-1" />
          <button onClick={() => setColor('#0f172a')} title="ممحاة" className={`p-1.5 rounded-full ${color === '#0f172a' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Eraser className="w-5 h-5" /></button>
          <button onClick={clearBoard} title="مسح الكل" className="p-1.5 rounded-full text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"><Trash2 className="w-5 h-5" /></button>
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className={`flex-1 w-full h-full touch-none ${canInteract ? 'cursor-crosshair' : 'cursor-default'}`}
      />
    </div>
  );
}
