import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, Video, Check, X, Mic, ChevronDown, Users, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

interface Contact {
  id: number;
  name: string;
  phone: string;
  initials: string;
}

export default function ContactsScreen() {
  const { t } = useLanguage();
  const { user } = useUser();
  const [hasShownSaveAlert, setHasShownSaveAlert] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [expandedSection, setExpandedSection] = useState<'none' | 'message' | 'call'>('none');
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
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        alert('Auth Error: Unauthenticated user. Please log in again.');
        return;
      }
      currentUserId = userData.user.id;
    } catch (err) {}

    if (!currentUserId) return;
    
    const newSelected = new Set<string>(selectedPhones);
    const isCurrentlySelected = newSelected.has(contact.phone);
    const willBeSelected = forceSelect !== undefined ? forceSelect : !isCurrentlySelected;

    if (willBeSelected) {
      try {
        // Insert/Upsert into Supabase FIRST
        const { error } = await supabase.from('selected_contacts').upsert({
          user_id: currentUserId,
          contact_number: contact.phone,
          contact_name: contact.name
        });
        
        if (error) {
          alert('Database Error (selected_contacts): ' + error.message);
          return; // STOP execution on failure
        }
        
        if (!hasShownSaveAlert) {
          alert('Contact Saved!');
          setHasShownSaveAlert(true);
        }

        // Update local state ONLY if successful
        newSelected.add(contact.phone);
        setSelectedPhones(newSelected);
        setIsSelectionMode(true);
      } catch (err: any) {
         console.error('Upsert failed', err);
         alert('Database Error (selected_contacts): ' + (err.message || 'Unknown network error.'));
      }
    } else {
      try {
        // Delete from Supabase FIRST
        const { error } = await supabase.from('selected_contacts')
          .delete()
          .match({ user_id: currentUserId, contact_number: contact.phone });
          
        if (error) {
          alert('Database Error (selected_contacts delete): ' + error.message);
          return; // STOP execution on failure
        }

        // Update local state ONLY if successful
        newSelected.delete(contact.phone);
        setSelectedPhones(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
      } catch (err: any) {
         console.error('Delete failed', err);
         alert('Database Error (selected_contacts delete): ' + (err.message || 'Unknown network error.'));
      }
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
        toggleContactSelection(contact, true);
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
      setActiveContact(contact);
      setExpandedSection('none');
    }
  };

  const startGroupCall = () => {
    setIsSelectionMode(false);
    navigate('/call', { state: { title: t('groupVideoCall') } });
  };

  // Find the phone of the last selected contact in the list
  const lastSelectedContactPhone = [...contacts].reverse().find(c => selectedPhones.has(c.phone))?.phone;

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Selection Header */}
      {isSelectionMode && (
        <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white px-4 py-3 flex items-center justify-between z-20 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={() => { setIsSelectionMode(false); }}>
              <X className="w-6 h-6" />
            </button>
            <span className="font-semibold text-lg">{selectedPhones.size} {t('selected')}</span>
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
            <React.Fragment key={`${contact.id}-${contact.phone}`}>
              <div
                onMouseDown={() => handleTouchStart(contact)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={() => handleTouchStart(contact)}
                onTouchEnd={handleTouchEnd}
                onClick={() => handleTap(contact)}
                className={`flex items-center px-4 py-3 cursor-pointer transition-colors select-none ${
                  isSelected ? 'bg-blue-900/30' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mr-4 ${
                  isSelected ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {isSelected ? <Check className="w-6 h-6" /> : contact.initials}
                </div>
                <div className="flex-1 border-b border-slate-800 pb-3 pt-1">
                  <h3 className="font-semibold text-slate-200">{contact.name}</h3>
                  <p className="text-sm text-slate-500" dir="ltr">{contact.phone}</p>
                </div>
              </div>

              {/* Inline Group Video Call Button under the last selected contact */}
              {isSelectionMode && contact.phone === lastSelectedContactPhone && (
                <div className="px-4 py-4 flex justify-end animate-in fade-in slide-in-from-top-2 bg-slate-800/30 border-b border-slate-800">
                  <button
                    onClick={startGroupCall}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.5)] flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 border border-blue-400/30"
                  >
                    <Video className="w-5 h-5" />
                    <span className="font-bold">{t('groupVideoCall')}</span>
                  </button>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Action Bottom Sheet (Accordion UI) */}
      {activeContact && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setActiveContact(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 rounded-t-3xl z-50 p-6 shadow-2xl transform transition-transform max-w-md mx-auto">
            <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-center mb-1 text-white">{activeContact.name}</h2>
            <p className="text-center text-blue-400 mb-8 font-medium" dir="ltr">{activeContact.phone}</p>
            
            <div className="flex items-stretch gap-4 w-full h-48">
              {/* Message Column */}
              <div 
                tabIndex={0}
                className="group relative flex-1 rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all duration-500 overflow-hidden cursor-pointer flex flex-col items-center justify-center focus:outline-none"
              >
                {/* Default State */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all duration-500 group-hover:-translate-y-8 group-hover:opacity-0 group-hover:scale-95 group-focus:-translate-y-8 group-focus:opacity-0 group-focus:scale-95">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white transform rotate-3 transition-transform duration-500 group-hover:rotate-0 group-focus:rotate-0">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <span className="font-bold text-lg text-slate-200 tracking-wide">{t('message')}</span>
                </div>

                {/* Hover/Active State */}
                <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 translate-y-8 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0 bg-slate-900/80 backdrop-blur-md">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveContact(null); }}
                    className="flex flex-col items-center gap-2 hover:scale-110 transition-transform p-2"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">{t('textMessage')}</span>
                  </button>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveContact(null); }}
                    className="flex flex-col items-center gap-2 hover:scale-110 transition-transform p-2"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-orange-400 border border-orange-500/30 hover:bg-orange-500 hover:text-white hover:shadow-[0_0_20px_rgba(249,115,22,0.5)] transition-all duration-300">
                      <Mic className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">{t('voiceMessage')}</span>
                  </button>
                </div>
              </div>

              {/* Call Column */}
              <div 
                tabIndex={0}
                className="group relative flex-1 rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 hover:border-green-500/50 hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all duration-500 overflow-hidden cursor-pointer flex flex-col items-center justify-center focus:outline-none"
              >
                {/* Default State */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all duration-500 group-hover:-translate-y-8 group-hover:opacity-0 group-hover:scale-95 group-focus:-translate-y-8 group-focus:opacity-0 group-focus:scale-95">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 text-white transform -rotate-3 transition-transform duration-500 group-hover:rotate-0 group-focus:rotate-0">
                    <Phone className="w-8 h-8" />
                  </div>
                  <span className="font-bold text-lg text-slate-200 tracking-wide">{t('call')}</span>
                </div>

                {/* Hover/Active State */}
                <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 translate-y-8 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0 bg-slate-900/80 backdrop-blur-md">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setActiveContact(null);
                      navigate('/call', { state: { title: t('audioCall') } });
                    }}
                    className="flex flex-col items-center gap-2 hover:scale-110 transition-transform p-2"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all duration-300">
                      <Phone className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">{t('audioCall')}</span>
                  </button>
                  
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setActiveContact(null);
                      navigate('/call', { state: { title: t('videoCall') } });
                    }}
                    className="flex flex-col items-center gap-2 hover:scale-110 transition-transform p-2"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-purple-400 border border-purple-500/30 hover:bg-purple-500 hover:text-white hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300">
                      <Video className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">{t('videoCall')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
