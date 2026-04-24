import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, Video, Check, X, Mic, ChevronDown, Users, Loader2, Trash2, UserPlus, Plus } from 'lucide-react';
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
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem('triosync_device_contacts');
    return saved ? JSON.parse(saved) : [];
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [chatSummaries, setChatSummaries] = useState<Record<string, { lastMessage: string, lastTime: string, unreadCount: number }>>({});
  const navigate = useNavigate();
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('triosync_device_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    let isMounted = true;

    // We do not load mock contacts anymore. 
    // And we rely on user action or previously saved contacts in localStorage.

    const handleFetch = () => triggerContactFetch();
    window.addEventListener('fetch-contacts', handleFetch);

    // Fetch Chat Summaries
    let channel: any = null;
    const fetchChats = async () => {
      if (!user || !isMounted) return;
      
      const { data: profiles } = await supabase.from('profiles').select('id, phone');
      if (!profiles || !isMounted) return;
      
      const profileToPhone = new Map<string, string>();
      const newSummaries: Record<string, { lastMessage: string, lastTime: string, unreadCount: number }> = {};
      
      profiles.forEach(p => {
        if (p.phone) {
          const cleanPhone = p.phone.replace(/\D/g, '').slice(-9);
          profileToPhone.set(p.id, cleanPhone);
          newSummaries[cleanPhone] = { lastMessage: '', lastTime: '', unreadCount: 0 };
        }
      });

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (!messages || !isMounted) return;

      messages.forEach(msg => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const otherPhone = profileToPhone.get(otherId);
        if (!otherPhone) return;

        newSummaries[otherPhone].lastMessage = msg.content;
        newSummaries[otherPhone].lastTime = msg.created_at;

        if (msg.receiver_id === user.id && msg.status !== 'read') {
          newSummaries[otherPhone].unreadCount += 1;
        }
      });

      setChatSummaries(newSummaries);
    };

    fetchChats();

    channel = supabase.channel('contacts_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchChats();
      })
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener('fetch-contacts', handleFetch);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    const newContact: Contact = {
      id: Date.now(),
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      initials: newContactName.trim().substring(0, 2).toUpperCase()
    };

    setContacts(prev => {
      const map = new Map();
      prev.forEach(c => map.set(c.phone, c));
      map.set(newContact.phone, newContact);
      return Array.from(map.values());
    });

    setNewContactName('');
    setNewContactPhone('');
    setShowAddForm(false);
  };

  const handleDeleteContact = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation(); // prevent tapping the row
    setContacts(prev => prev.filter(c => c.phone !== contact.phone));
    // If it was selected, un-select it
    if (selectedContactIds.includes(contact.phone)) {
      toggleSelection({ id: contact.phone, name: contact.name }, false);
    }
  };

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
          setErrorMessage('Browser Contacts API unsupported on this device. Please add contacts manually.');
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

  const startGroupCall = (isVideo: boolean = true) => {
    // We could clear selection or leave it
    navigate('/call', { state: { title: t('groupVideoCall'), count: selectedContactIds.length, type: isVideo ? 'video' : 'audio' } });
  };

  const lastSelectedContactPhone = selectedContactIds.length > 0 ? selectedContactIds[selectedContactIds.length - 1] : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      
      {/* Contact Tools Header */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-slate-800/60 bg-slate-900 z-10 shadow-sm">
        <button 
          onClick={() => triggerContactFetch()} 
          className="flex items-center gap-2 text-[13px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Users className="w-4 h-4" /> Load Device Contacts
        </button>
        <button 
          onClick={() => setShowAddForm(!showAddForm)} 
          className="flex items-center gap-2 text-[13px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Add Manual
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-800/50 border-b border-slate-800/60"
            onSubmit={handleManualAdd}
          >
            <div className="p-4 flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Name" 
                value={newContactName}
                onChange={e => setNewContactName(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                required
              />
              <input 
                type="tel" 
                placeholder="Phone (e.g. +123...)" 
                value={newContactPhone}
                onChange={e => setNewContactPhone(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                required
              />
              <div className="flex justify-end gap-2 mt-1">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                >
                  Save Contact
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

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
            const cleanPhone = contact.phone.replace(/\D/g, '').slice(-9);
            const chatInfo = chatSummaries[cleanPhone];
            
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
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mr-4 transition-all duration-300 shrink-0 ${
                  isSelected ? 'bg-[#00b4d8] text-white shadow-md' : 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30'
                }`}>
                  {isSelected ? <Check className="w-6 h-6" /> : contact.initials}
                </div>
                <div className="flex-1 border-b border-slate-800/60 pb-3 pt-1 flex justify-between items-center pr-2 min-w-0">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex justify-between items-baseline mb-0.5 min-w-0 gap-2">
                      <h3 className={`font-semibold transition-colors text-[17px] truncate flex-1 min-w-0 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {contact.name}
                      </h3>
                      {chatInfo?.lastTime && (
                         <span className={`text-[11px] shrink-0 ml-2 ${chatInfo.unreadCount > 0 ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
                           {new Date(chatInfo.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 min-w-0">
                       <p className={`text-[14px] truncate flex-1 min-w-0 ${isSelected || (chatInfo?.unreadCount && chatInfo.unreadCount > 0) ? 'text-blue-100 font-medium' : 'text-slate-400'}`}>
                         {chatInfo?.lastMessage 
                            ? (chatInfo.lastMessage.startsWith('File: ') ? '📎 Attachment' : chatInfo.lastMessage)
                            : (
                               <span className="text-[13px]" dir="ltr">{contact.phone}</span>
                            )
                         }
                       </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Unread Badge */}
                    {chatInfo && chatInfo.unreadCount > 0 && !isSelectionMode && (
                      <div className="bg-blue-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] flex items-center justify-center">
                        {chatInfo.unreadCount}
                      </div>
                    )}
                    
                    {/* Delete Button */}
                    {!isSelectionMode && (!chatInfo || chatInfo.lastMessage === '') && (
                      <button
                        onClick={(e) => handleDeleteContact(e, contact)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors active:scale-95"
                      >
                        <Trash2 className="w-[18px] h-[18px]" />
                      </button>
                    )}
                  </div>
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
                        onClick={(e) => { e.stopPropagation(); startGroupCall(false); }}
                        className="w-[48px] h-[48px] rounded-full bg-[#00b4d8] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,180,216,0.5)] hover:brightness-110 active:scale-95 transition-all outline-none"
                    >
                         <Phone fill="currentColor" stroke="none" className="w-[20px] h-[20px]" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); startGroupCall(true); }}
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
