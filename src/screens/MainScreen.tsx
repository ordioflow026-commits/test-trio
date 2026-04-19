import React, { useState, useEffect } from 'react';
import { Home, Bell, User, Users, Lock, Radio, Globe, MessageSquare, Plus, LogIn } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import ContactsScreen from './ContactsScreen';
import PrivateRoomScreen from './PrivateRoomScreen';
import BroadcastScreen from './BroadcastScreen';

export default function MainScreen() {
  const [activeMainTab, setActiveMainTab] = useState('home');
  const [activeSubTab, setActiveSubTab] = useState('contacts');
  const { t, dir, language, toggleLanguage } = useLanguage();
  const [userData, setUserData] = useState({ fullName: 'Guest', phone: '' });
  const [hasNotifications, setHasNotifications] = useState(true); // Mock state for red dot

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserData({
          fullName: parsed.fullName || 'Guest',
          phone: parsed.phone || ''
        });
      } catch (e) {
        console.error('Failed to parse user data', e);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col font-sans" dir={dir}>
      {/* Top Navigation Bar */}
      <header className="bg-[#0F172A]/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex justify-between items-center h-20 px-4">
          {/* Left: Logo */}
          <div className="w-24 flex items-center gap-2">
            <img src="/trio_sync_logo.svg" alt="TrioSync Logo" className="w-8 h-8 rounded-lg shadow-md shadow-blue-500/20" />
            <span className="text-sm font-bold text-white tracking-wide hidden sm:block">TrioSync</span>
          </div>

          {/* Center Frame for Main Icons */}
          <div className="flex items-center bg-slate-800/80 rounded-full p-1.5 border border-blue-900/50 shadow-inner gap-1">
            <button
              onClick={() => setActiveMainTab('home')}
              className={`p-3 rounded-full transition-all duration-300 border ${
                activeMainTab === 'home'
                  ? 'bg-blue-700 border-blue-500 text-white shadow-[0_0_15px_rgba(29,78,216,0.5)]'
                  : 'border-blue-500/50 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20'
              }`}
            >
              <Home className="w-6 h-6" />
            </button>
            
            <button
              onClick={() => {
                setActiveMainTab('notifications');
                setHasNotifications(false);
              }}
              className={`relative p-3 rounded-full transition-all duration-300 border ${
                activeMainTab === 'notifications'
                  ? 'bg-blue-700 border-blue-500 text-white shadow-[0_0_15px_rgba(29,78,216,0.5)]'
                  : 'border-blue-500/50 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20'
              }`}
            >
              <Bell className="w-6 h-6" />
              {hasNotifications && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-[#0F172A] rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
              )}
            </button>
            
            <button
              onClick={() => setActiveMainTab('profile')}
              className={`p-3 rounded-full transition-all duration-300 border ${
                activeMainTab === 'profile'
                  ? 'bg-blue-700 border-blue-500 text-white shadow-[0_0_15px_rgba(29,78,216,0.5)]'
                  : 'border-blue-500/50 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20'
              }`}
            >
              <User className="w-6 h-6" />
            </button>
          </div>

          {/* Right: Language Toggle */}
          <div className="w-24 flex justify-end">
            <button
              onClick={toggleLanguage}
              className="flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-colors bg-slate-800/50 p-2 rounded-2xl border border-blue-900/50 hover:border-blue-600"
            >
              <Globe className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold tracking-wider">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation (Only visible when Home is active) */}
        {activeMainTab === 'home' && (
          <div className="flex justify-around items-center p-4 bg-[#0F172A]/50 border-t border-blue-900/30 gap-3">
            {[
              { id: 'contacts', label: t('contacts'), icon: Users },
              { id: 'privateRoom', label: t('privateRoom'), icon: Lock },
              { id: 'broadcast', label: t('broadcast'), icon: Radio },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center py-3 px-1 rounded-2xl transition-all duration-300 border ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-[0_8px_16px_rgba(29,78,216,0.4)] scale-105 border-blue-500'
                      : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-blue-400 border-blue-500/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
                  <span className={`text-[11px] font-bold tracking-wide ${isActive ? 'text-white' : ''}`}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeMainTab === 'home' && (
          <>
            {activeSubTab === 'contacts' && <ContactsScreen />}
            {activeSubTab === 'privateRoom' && <PrivateRoomScreen />}
            {activeSubTab === 'broadcast' && <BroadcastScreen />}
          </>
        )}

        {activeMainTab === 'notifications' && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 bg-gradient-to-b from-transparent to-slate-900/50">
            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700/50 shadow-lg">
              <Bell className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-xl font-bold text-slate-200">{t('notifications')}</p>
            <p className="text-sm mt-3 text-slate-400">You're all caught up!</p>
          </div>
        )}

        {activeMainTab === 'profile' && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 bg-gradient-to-b from-transparent to-slate-900/50">
            <div className="relative mb-6">
              <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-1 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center border-4 border-slate-900">
                  <User className="w-12 h-12 text-slate-300" />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 border-4 border-slate-900 rounded-full"></div>
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">{userData.fullName}</p>
            <p className="text-md mt-2 text-blue-400 font-medium" dir="ltr">{userData.phone}</p>
          </div>
        )}
      </main>
    </div>
  );
}
