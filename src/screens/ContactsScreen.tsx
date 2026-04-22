import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, Video, Check, X, Mic, ChevronDown, Users, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useSelection } from '../contexts/SelectionContext';
import { motion, AnimatePresence } from 'motion/react';

interface Contact {
  id: number;
  name: string;
  phone: string;
  initials: string;
}

export default function ContactsScreen() {
  const { t } = useLanguage();
  const { user } = useUser();
  const { isSelectionMode, selectedContactIds, selectedContacts, toggleSelection } = useSelection();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const navigate = useNavigate();
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Load any already selected contacts from the context initially so the list isn't completely empty
    if (isMounted && selectedContacts.length > 0 && contacts.length === 0) {
      setContacts(selectedContacts.map((c, i) => ({
        id: i + 10000,
        name: c.name,
        phone: c.id, 
        initials: (c.name || 'U').substring(0, 2).toUpperCase()
      })));
    }

    // Since we require user interaction for browser API, do not force triggerContactFetch on load here.
    // The user will tap "Load Contacts" button instead if nothing is there.
    // But if Capacitor is native platform, it's fine to fetch automatically!
    if (Capacitor.isNativePlatform() && isMounted && contacts.length === 0) {
      triggerContactFetch();
    } else if (contacts.length === 0 && selectedContacts.length === 0) {
      // Fallback mock contacts so the screen isn't entirely empty initially:
      setContacts([
          { id: 1, name: 'Alice Smith', phone: '+1234567890', initials: 'AL' },
          { id: 2, name: 'Bob Johnson', phone: '+0987654321', initials: 'BO' }
      ]);
    }

    const handleFetch = () => triggerContactFetch();
    window.addEventListener('fetch-contacts', handleFetch);

    return () => {
      isMounted = false;
      window.removeEventListener('fetch-contacts', handleFetch);
    };
  }, [user, selectedContacts]);

  const triggerContactFetch = async () => {
    setIsLoadingContacts(true);
    setErrorMessage(null);

    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Contacts.requestPermissions();
        if (perm.contacts === 'granted') {
          const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
          if (result.contacts && result.contacts.length > 0) {
            const mappedContacts = result.contacts.map((c, i) => ({
              id: i,
              name: c.name?.display || 'Unknown',
              phone: c.phones?.[0]?.number || 'No phone',
              initials: (c.name?.display || 'U').substring(0, 2).toUpperCase()
            }));
            
            setContacts(prev => {
               const map = new Map();
               prev.forEach(c => map.set(c.phone, c));
               mappedContacts.forEach(c => map.set(c.phone, c));
               return Array.from(map.values());
            });
          } else {
            setErrorMessage('No native contacts found.');
          }
        } else {
          setErrorMessage('Permission denied for native device contacts.');
        }
      } else {
        // Web Contacts API
        if ('contacts' in navigator && 'ContactsManager' in window) {
          const webContacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
          
          if (webContacts && webContacts.length > 0) {
            const mappedContacts = webContacts.map((c: any, i: number) => {
              const name = c.name?.[0] || 'Unknown';
              const phone = c.tel?.[0] || 'No phone';
              return { id: i, name, phone, initials: name.substring(0, 2).toUpperCase() };
            });
            
            setContacts(prev => {
               const map = new Map();
               prev.forEach(c => map.set(c.phone, c));
               mappedContacts.forEach(c => map.set(c.phone, c));
               return Array.from(map.values());
            });
          } else {
            setErrorMessage('No valid web contacts selected.');
          }
        } else {
          setErrorMessage('Browser Contacts API unsupported. Here is mock data.');
          setContacts(prev => {
            const map = new Map();
            prev.forEach(c => map.set(c.phone, c));
            // Add mock
            map.set('+1122334455', { id: 3, name: 'Charlie Mock', phone: '+1122334455', initials: 'CH' });
            map.set('+5544332211', { id: 4, name: 'David Fallback', phone: '+5544332211', initials: 'DA' });
            return Array.from(map.values());
          });
        }
      }
    } catch (err: any) {
      console.error('Contact fetch failed:', err);
      if (err.name === 'SecurityError' || err.message?.includes('user activation')) {
        setErrorMessage('Browser requires a tap to load contacts. Click the button below.');
      } else {
        setErrorMessage('Failed to load device contacts.');
      }
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleTouchStart = (contact: Contact) => {
    longPressTimer.current = setTimeout(() => {
      if (!isSelectionMode) {
        // Automatically selects by calling to Context
        toggleSelection({ id: contact.phone, name: contact.name }, true);
        setExpandedContactId(null);
      }
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTap = (contact: Contact) => {
    if (isSelectionMode) {
      toggleSelection({ id: contact.phone, name: contact.name });
    } else {
      navigate('/chat', { state: { contact } });
    }
  };

  const startGroupCall = () => {
    // We could clear selection or leave it
    navigate('/call', { state: { title: t('groupVideoCall') } });
  };

  const lastSelectedContactPhone = selectedContactIds.length > 0 ? selectedContactIds[selectedContactIds.length - 1] : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto pt-2 pb-20">
        
        {/* Inline Loading Spinner */}
        {isLoadingContacts && (
          <div className="flex flex-col items-center justify-center p-6 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
            <span className="text-sm font-medium">Loading contacts...</span>
          </div>
        )}

        {/* Error / Fallback Message Rendering */}
        {!isLoadingContacts && (!contacts || contacts.length === 0 || errorMessage) && (
          <div className="flex flex-col items-center justify-center p-6 mt-10 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-lg">
               <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-300 mb-6 text-sm">
              {errorMessage || 'No contacts currently loaded.'}
            </p>
            <button 
              onClick={() => triggerContactFetch()}
              className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl font-semibold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all active:scale-95 text-sm"
            >
              Load Device Contacts
            </button>
          </div>
        )}

        {contacts.map((contact) => {
            const isSelected = selectedContactIds.includes(contact.phone);
            return (
            <div key={`${contact.id}-${contact.phone}`} className="relative">
              <div
                onMouseDown={() => handleTouchStart(contact)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={() => handleTouchStart(contact)}
                onTouchEnd={handleTouchEnd}
                onClick={() => handleTap(contact)}
                className={`flex items-center px-4 py-3 cursor-pointer transition-colors select-none ${
                  isSelected ? 'bg-[#0070a8]' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mr-4 transition-all duration-300 ${
                  isSelected ? 'bg-[#00b4d8] text-white shadow-md' : 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30'
                }`}>
                  {isSelected ? <Check className="w-6 h-6" /> : contact.initials}
                </div>
                <div className="flex-1 border-b border-slate-800/60 pb-3 pt-1">
                  <h3 className={`font-semibold transition-colors text-[17px] ${isSelected ? 'text-white' : 'text-slate-200'}`}>{contact.name}</h3>
                  <p className={`text-[13px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`} dir="ltr">{contact.phone}</p>
                </div>
              </div>
              
              {/* Dynamic Floating Action Buttons for Last Selected Contact */}
              <AnimatePresence>
                {isSelectionMode && contact.phone === lastSelectedContactPhone && (
                  <motion.div
                    layoutId="dynamic-fab"
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <button
                        onClick={(e) => { e.stopPropagation(); startGroupCall(); }}
                        className="w-[48px] h-[48px] rounded-full bg-[#00b4d8] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,180,216,0.5)] hover:brightness-110 active:scale-95 transition-all outline-none"
                    >
                         <Phone fill="currentColor" stroke="none" className="w-[20px] h-[20px]" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); startGroupCall(); }}
                        className="w-[48px] h-[48px] rounded-full bg-[#00e676] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,230,118,0.5)] hover:brightness-110 active:scale-95 transition-all outline-none"
                    >
                         <Video fill="currentColor" stroke="none" className="w-[20px] h-[20px]" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
