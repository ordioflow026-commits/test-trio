/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AppState, UserProfile } from './types';
import { RegistrationView } from './components/RegistrationView';
import { HomeView } from './components/HomeView';
import { ScannerView } from './components/ScannerView';
import { RoomView } from './components/RoomView';
import { AdModal } from './components/AdModal';

export default function App() {
  const [appState, setAppState] = useState<AppState>('registration');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [timeBalance, setTimeBalance] = useState(60); // 60 seconds
  const [showAd, setShowAd] = useState(false);

  const handleRegistrationComplete = (profile: UserProfile) => {
    setCurrentUser(profile);
    setAppState('home');
  };

  const handleCreateRoom = () => {
    setIsCreator(true);
    setAppState('room');
  };

  const handleJoinRoom = () => {
    setIsCreator(false);
    setAppState('scanner');
  };

  const handleScanSuccess = () => {
    setAppState('room');
  };

  const handleLeaveRoom = () => {
    setAppState('home');
    setIsCreator(false);
  };

  return (
    <div className="w-full h-[100dvh] bg-black text-white font-sans overflow-hidden selection:bg-emerald-500/30">
      <AnimatePresence mode="wait">
        {appState === 'registration' && (
          <RegistrationView key="registration" onComplete={handleRegistrationComplete} />
        )}
        
        {appState === 'home' && (
          <HomeView 
            key="home" 
            onCreateRoom={handleCreateRoom} 
            onJoinRoom={handleJoinRoom} 
          />
        )}
        
        {appState === 'scanner' && (
          <ScannerView 
            key="scanner" 
            onScanSuccess={handleScanSuccess} 
            onCancel={() => setAppState('home')} 
          />
        )}
        
        {appState === 'room' && currentUser && (
          <RoomView 
            key="room" 
            currentUser={currentUser} 
            isCreator={isCreator}
            timeBalance={timeBalance}
            setTimeBalance={setTimeBalance}
            onLeave={handleLeaveRoom}
            onRechargeRequired={() => setShowAd(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAd && (
          <AdModal 
            onComplete={() => {
              setTimeBalance(prev => prev + 60);
              setShowAd(false);
            }} 
            onCancel={() => setShowAd(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
