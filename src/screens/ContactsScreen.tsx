import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, Video, Check, X, Mic, ChevronDown, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Contact {
  id: number;
  name: string;
  phone: string;
  initials: string;
}

const DUMMY_NAMES = [
  'Ahmed Hassan', 'Sarah Al-Fayed', 'Mohammed Ali', 'Fatima Zahra', 
  'Omar Farooq', 'Aisha Rahman', 'Khalid Saeed', 'Nour El-Din', 
  'Youssef Ibrahim', 'Layla Mahmoud'
];

const FALLBACK_CONTACTS: Contact[] = DUMMY_NAMES.map((name, i) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  return {
    id: i,
    name: name,
    phone: `+1 555 010${i.toString().padStart(2, '0')}`,
    initials: initials
  };
});

export default function ContactsScreen() {
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [expandedSection, setExpandedSection] = useState<'none' | 'message' | 'call'>('none');
  const navigate = useNavigate();
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Auto-load for web preview testing
    requestContactsPermission();
  }, []);

  const requestContactsPermission = async () => {
    setIsLoading(true);
    try {
      // In a real web environment, navigator.contacts requires HTTPS and user gesture.
      // We simulate the permission flow here.
      const supported = 'contacts' in navigator && 'ContactsManager' in window;
      
      if (supported) {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        try {
          const rawContacts = await (navigator as any).contacts.select(props, opts);
          const formattedContacts = rawContacts.map((c: any, i: number) => ({
            id: i,
            name: c.name?.[0] || 'Unknown',
            phone: c.tel?.[0] || 'No phone',
            initials: (c.name?.[0] || 'U').substring(0, 2).toUpperCase()
          }));
          setContacts(formattedContacts.length > 0 ? formattedContacts : FALLBACK_CONTACTS);
          setPermissionGranted(true);
        } catch (err) {
          console.error("Contacts selection failed:", err);
          setContacts(FALLBACK_CONTACTS);
          setPermissionGranted(false);
        }
      } else {
        // Fallback for browsers that don't support the Contact Picker API
        setTimeout(() => {
          setContacts(FALLBACK_CONTACTS);
          setPermissionGranted(true); // Pretend granted for fallback so UI shows contacts
          setIsLoading(false);
        }, 800); // Short delay for realism
        return;
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts(FALLBACK_CONTACTS);
      setPermissionGranted(true); // Force true to show dummy contacts
    } finally {
      setIsLoading(false);
    }
  };

  const handleTouchStart = (id: number) => {
    longPressTimer.current = setTimeout(() => {
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        setSelectedIds(new Set([id]));
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
      const newSelected = new Set(selectedIds);
      if (newSelected.has(contact.id)) {
        newSelected.delete(contact.id);
        if (newSelected.size === 0) setIsSelectionMode(false);
      } else {
        newSelected.add(contact.id);
      }
      setSelectedIds(newSelected);
    } else {
      setActiveContact(contact);
      setExpandedSection('none');
    }
  };

  const startGroupCall = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    navigate('/call', { state: { title: t('groupVideoCall') } });
  };

  // Find the ID of the last selected contact in the list
  const lastSelectedContactId = [...contacts].reverse().find(c => selectedIds.has(c.id))?.id;

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Selection Header */}
      {isSelectionMode && (
        <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white px-4 py-3 flex items-center justify-between z-20 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}>
              <X className="w-6 h-6" />
            </button>
            <span className="font-semibold text-lg">{selectedIds.size} {t('selected')}</span>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto pt-2 pb-20">
        {isLoading ? (
          // Shimmer Loading Effect
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center px-4 py-3 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-slate-800 mr-4"></div>
              <div className="flex-1 border-b border-slate-800 pb-3 pt-1">
                <div className="h-4 bg-slate-800 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-slate-800 rounded w-1/4"></div>
              </div>
            </div>
          ))
        ) : permissionGranted === null ? (
          // Initial State
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Users className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Sync Contacts</h3>
            <p className="text-slate-400 mb-6">Connect your address book to find friends and start chatting.</p>
            <button onClick={requestContactsPermission} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-bold transition-colors">
              Sync Contacts
            </button>
          </div>
        ) : !permissionGranted && contacts === FALLBACK_CONTACTS ? (
          // Permission Denied State (Optional, but good for UX)
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Users className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Contacts Permission Required</h3>
            <p className="text-slate-400 mb-6">Please allow access to your contacts to see them here.</p>
            <button onClick={requestContactsPermission} className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold">
              Grant Permission
            </button>
          </div>
        ) : (
          contacts.map((contact) => {
            const isSelected = selectedIds.has(contact.id);
            return (
            <React.Fragment key={contact.id}>
              <div
                onMouseDown={() => handleTouchStart(contact.id)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={() => handleTouchStart(contact.id)}
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
              {isSelectionMode && contact.id === lastSelectedContactId && (
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
        }))}
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
