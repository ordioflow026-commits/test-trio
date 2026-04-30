import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, Video, Check, X, Mic, ChevronDown, Users, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const navigate = useNavigate();
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Removed global loadSavedAndFetch here and implemented it tightly within the useEffect
  useEffect(() => {
    let isMounted = true;

    const initContacts = async () => {
      // 1. Initial Load: Query Supabase using real session ID
      let currentUserId = user?.id;
      
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user?.id) {
          console.error('Session fetch failed', userError?.message);
        } else {
          currentUserId = userData.user.id;
        }
      } catch (err) {
        console.error('Session fetch failed', err);
      }

      if (currentUserId) {
        try {
          const { data, error } = await supabase.from('selected_contacts')
            .select('*')
            .eq('user_id', currentUserId);
          
          if (isMounted && !error && data) {
            const savedSelected = new Set<string>();
            const savedContacts: Contact[] = data.map((c: any, index: number) => {
              const fetchedPhone = c.contact_number || c.phone;
              const fetchedName = c.contact_name || c.name || 'Unknown';
              savedSelected.add(fetchedPhone);
              return {
                id: index + 10000, 
                name: fetchedName,
                phone: fetchedPhone,
                initials: fetchedName.substring(0, 2).toUpperCase()
              };
            });

            // Set immediately so user sees their saved contacts right away
            if (savedContacts.length > 0) {
              setContacts(savedContacts);
              setSelectedPhones(savedSelected);
              setIsSelectionMode(true);
            }
          }
        } catch (err) {
          console.error('Initial sync error', err);
        }
      }

      // 2. Fetch fresh device contacts
      if (isMounted) {
        triggerContactFetch();
      }
    };

    initContacts();

    // Support explicit re-fetches
    const handleFetch = () => triggerContactFetch();
    window.addEventListener('fetch-contacts', handleFetch);

    return () => {
      isMounted = false;
      window.removeEventListener('fetch-contacts', handleFetch);
    };
  }, [user]);

  const toggleContactSelection = async (contact: Contact, forceSelect?: boolean) => {
    let currentUserId = user?.id;
    if (!currentUserId && supabase.auth) {
        try {
          const { data } = await supabase.auth.getUser();
          currentUserId = data?.user?.id;
        } catch (e) {}
    }
    if (!currentUserId) return;
    
    const newSelected = new Set<string>(selectedPhones);
    const isCurrentlySelected = newSelected.has(contact.phone);
    const willBeSelected = forceSelect !== undefined ? forceSelect : !isCurrentlySelected;

    // Optimistic UI update
    if (willBeSelected) {
      newSelected.add(contact.phone);
      setSelectedPhones(newSelected);
      setIsSelectionMode(true);
      setExpandedContactId(null);
      
      supabase.from('selected_contacts').upsert({
        user_id: currentUserId,
        contact_number: contact.phone,
        contact_name: contact.name
      }).then(({error}) => {
        if (error) console.error("Error saving contact", error);
      });
    } else {
      newSelected.delete(contact.phone);
      setSelectedPhones(newSelected);
      if (newSelected.size === 0) setIsSelectionMode(false);
      
      supabase.from('selected_contacts')
        .delete()
        .match({ user_id: currentUserId, contact_number: contact.phone })
        .then(({error}) => {
          if (error) console.error("Error deleting contact", error);
        });
    }
  };

  const triggerContactFetch = async () => {
    setIsLoadingContacts(true);
    setErrorMessage(null);

    try {
      if (Capacitor.isNativePlatform()) {
        // Native Capacitor Request
        let perm = await Contacts.checkPermissions();
        if (perm.contacts !== 'granted') {
          perm = await Contacts.requestPermissions();
        }
        if (perm.contacts === 'granted') {
          const result = await Contacts.getContacts({
            projection: { name: true, phones: true },
          });
          
          if (result.contacts && result.contacts.length > 0) {
            const mappedContacts = result.contacts.map((c, i) => ({
              id: i,
              name: c.name?.display || 'Unknown',
              phone: c.phones?.[0]?.number || 'No phone',
              initials: (c.name?.display || 'U').substring(0, 2).toUpperCase()
            }));
            
            // Merge device contacts with existing selection so nothing disappears
            setContacts(prev => {
               const map = new Map();
               prev.forEach(c => map.set(c.phone, c));
               mappedContacts.forEach(c => map.set(c.phone, c));
               return Array.from(map.values());
            });
          } else {
            setErrorMessage('No contacts found.');
          }
        } else {
          setErrorMessage('Permission Denied. Please enable contact permissions in your device settings.');
        }
      } else {
        // Mobile Browser Priority / Web Contacts API Fallback
        if ('contacts' in navigator && 'ContactsManager' in window) {
          const props = ['name', 'tel'];
          const opts = { multiple: true };
          
          const webContacts = await (navigator as any).contacts.select(props, opts);
          
          if (webContacts && webContacts.length > 0) {
            const mappedContacts = webContacts.map((c: any, i: number) => {
              const name = c.name?.[0] || 'Unknown';
              const phone = c.tel?.[0] || 'No phone';
              return {
                id: i,
                name,
                phone,
                initials: name.substring(0, 2).toUpperCase()
              };
            });
            
            setContacts(prev => {
               const map = new Map();
               prev.forEach(c => map.set(c.phone, c));
               mappedContacts.forEach(c => map.set(c.phone, c));
               return Array.from(map.values());
            });
          } else {
            setErrorMessage('No contacts found.');
          }
        } else {
          setErrorMessage('Web Contacts API is not supported in this browser. Please use the native app.');
        }
      }
    } catch (err: any) {
      console.error('Contact fetch failed:', err);
      if (err.name === 'SecurityError' || err.message?.includes('user activation')) {
        setErrorMessage('Browser requires a tap to load contacts.');
      } else {
        setErrorMessage('Please enable contact permissions in your browser settings.');
      }
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleTouchStart = (contact: Contact) => {
    longPressTimer.current = setTimeout(() => {
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        toggleContactSelection(contact, true);
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
      toggleContactSelection(contact);
    } else {
      navigate('/chat', { state: { contact } });
    }
  };

  const startGroupCall = () => {
    setIsSelectionMode(false);
    navigate('/call', { state: { title: t('groupVideoCall') } });
  };

  const lastSelectedContactPhone = Array.from(selectedPhones).pop();

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Selection Header */}
      {isSelectionMode && (
        <div className="absolute top-0 left-0 right-0 bg-[#00b4d8] text-white px-4 py-3 flex items-center justify-between z-20 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={() => { setIsSelectionMode(false); }}>
              <X className="w-6 h-6" />
            </button>
            <span className="font-semibold text-lg">{selectedPhones.size} {t('selected') || 'Selected'}</span>
          </div>
        </div>
      )}

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
        {!isLoadingContacts && (!contacts || contacts.length === 0) && (
          <div className="flex flex-col items-center justify-center p-6 mt-10 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-lg">
               <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-300 mb-6 text-sm">
              {errorMessage || 'No contacts found.'}
            </p>
            <button 
              onClick={() => triggerContactFetch()}
              className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl font-semibold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all active:scale-95 text-sm"
            >
              Please enable contact permissions in your browser settings
            </button>
          </div>
        )}

        {contacts.map((contact) => {
            const isSelected = selectedPhones.has(contact.phone);
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
