import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Buffer } from 'buffer';
import process from 'process';
import util from 'util';
import { EventEmitter } from 'events';
import App from './App.tsx';
import './index.css';

// Polyfill for Buffer, process, global, util, and EventEmitter
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  if (!(window as any).process.env) (window as any).process.env = {};
  (window as any).process.env.NODE_ENV = (import.meta as any).env?.MODE || 'development';
  (window as any).global = window;
  (window as any).util = util;
  (window as any).EventEmitter = EventEmitter;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
