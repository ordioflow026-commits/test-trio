import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, Video, Check, X, Mic, ChevronDown, Users, AlertCircle, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-red-500', 'bg-green-500', 'bg-blue-500', 
    'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 
    'bg-teal-500', 'bg-indigo-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [hasAttemptedImport, setHasAttemptedImport] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const navigate = useNavigate();
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const syncContactsToSupabase = async (deviceContacts: Contact[]) => {
    // Uses context user to avoid lock contention
    const authUid = user?.id;

    if (!authUid) {
      console.warn("Active user session missing. Cannot save contacts remotely.");
      return deviceContacts;
    }
    if (deviceContacts.length === 0) return deviceContacts;
    
    try {
      console.log("Starting sync for user auth UID:", authUid);
      // Fetch existing contacts to avoid duplicates
      const { data: existing, error: fetchError } = await supabase
        .from('user_phone_contacts')
        .select('contact_phone')
        .eq('user_id', authUid);
        
      if (fetchError) {
        console.error("Error fetching existing contacts:", fetchError);
      }
        
      const existingPhones = new Set((existing || []).map(c => c.contact_phone));
      
      // Filter out contacts that already exist in DB
      const newContacts = deviceContacts.filter(c => !existingPhones.has(c.phone));
      
      if (newContacts.length > 0) {
        const insertData = newContacts.map(c => ({
          user_id: authUid,
          contact_name: c.name,
          contact_phone: c.phone
        }));
        
        console.log("Inserting new contacts:", insertData);
        const { error: insertError } = await supabase.from('user_phone_contacts').insert(insertData);
        
        if (insertError) {
          console.error("Insert Error:", insertError);
          // Removed alert here so it doesn't interrupt background syncs
        } else {
          console.log("Successfully inserted contacts!");
          // Removed intrusive "Contacts saved to DB!" alert
        }
      } else {
        console.log("No new contacts to insert (all already exist).");
      }
      
      return deviceContacts;
    } catch (error: any) {
      console.error("Error syncing contacts to Supabase:", error);
      return deviceContacts;
    }
  };

  useEffect(() => {
    const fetchAndSetContacts = async () => {
      try {
        const cached = localStorage.getItem('cached_contacts');
        if (cached) {
          setContacts(JSON.parse(cached));
          setIsLoading(false);
        }
      } catch (e) {
        console.error('Failed to parse cached contacts', e);
      }
      
      setIsLoading(true);
      
      let realContacts: any[] = [];
      
      // Step 1: Force native contact fetch if on a native platform
      if (Capacitor.isNativePlatform()) {
        try {
          const checkPerm = await Contacts.checkPermissions();
          let permissionGranted = checkPerm.contacts === 'granted';
          
          if (!permissionGranted) {
            const requestPerm = await Contacts.requestPermissions();
            permissionGranted = requestPerm.contacts === 'granted';
          }

          if (permissionGranted) {
            const result = await Contacts.getContacts({
              projection: { name: true, phones: true }
            });
            
            realContacts = result.contacts
              .filter(c => c.name?.display && c.phones && c.phones.length > 0)
              .map((c, i) => {
                const name = c.name?.display || 'Unknown';
                const phone = c.phones?.[0]?.number || 'No phone';
                const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                return { id: `native-${i}`, name, phone, initials };
              });
              
            // Automatically push them to Supabase
            if (realContacts.length > 0) {
              await syncContactsToSupabase(realContacts);
            }
          }
        } catch(e) {
          console.error("Native contacts fetch error:", e);
        }
      }

      // Step 2: Fallback or merge with Supabase Database Contacts
      try {
        if (user?.id) {
          const { data: savedContacts, error } = await supabase
            .from('user_phone_contacts')
            .select('*')
            .eq('user_id', user.id);
            
          if (error) {
            console.error("Error fetching saved contacts:", error);
          } else if (savedContacts && savedContacts.length > 0) {
            const dbContacts = savedContacts.map((c, i) => {
              const name = c.contact_name || c.name || 'Unknown';
              const phone = c.contact_phone || c.phone || 'No phone';
              const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
              return { id: `db-${i}`, name, phone, initials };
            });
            
            // Merge resolving duplicates
            const phoneSet = new Set();
            const merged = [...realContacts, ...dbContacts].filter(c => {
               if(phoneSet.has(c.phone)) return false;
               phoneSet.add(c.phone);
               return true;
            });
            
            realContacts = merged;
          }
        }
      } catch (err: any) {
        console.error("Error fetching saved DB contacts:", err);
      }

      // Final output assignment!
      if (realContacts.length === 0) {
        realContacts = [
          { id: 'demo-1', name: 'Test User US', phone: '+1 555 012 3456', initials: 'US' },
          { id: 'demo-2', name: 'Test User UK', phone: '+44 770 090 0077', initials: 'UK' },
          { id: 'demo-3', name: 'Test User KSA', phone: '+966 50 000 0000', initials: 'KS' }
        ];
      }
      setContacts(realContacts);
      localStorage.setItem('cached_contacts', JSON.stringify(realContacts));
      setIsLoading(false);
    };

    fetchAndSetContacts();
  }, [user?.id]); // Run precisely once on mount or when user changes

  const importContacts = async () => {
    if (!isSupported || Capacitor.isNativePlatform()) return;
    
    setHasAttemptedImport(true);
    setIsLoading(true);
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      
      const rawContacts = await (navigator as any).contacts.select(props, opts);
      
      const formattedContacts = rawContacts.map((c: any, i: number) => {
        const name = c.name?.[0] || 'Unknown';
        const phone = c.tel?.[0] || 'No phone';
        const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        return { id: i, name, phone, initials };
      });
      
      if (formattedContacts.length > 0) {
        // EXACT REQUIREMENT: Right after returning, automatically insert via sync function.
        await syncContactsToSupabase(formattedContacts);
        
        // Sync to State so they appear on screen automatically
        setContacts(prev => {
          const existingPhones = new Set(prev.map(p => p.phone));
          const newUnique = formattedContacts.filter((c: Contact) => !existingPhones.has(c.phone));
          return [...prev, ...newUnique];
        });
      }
    } catch (error) {
      console.error("Contacts selection failed or was cancelled:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLongPress = (id: number) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set([id]));
    }
  };

  const handleTouchStart = (id: number) => {
    longPressTimer.current = setTimeout(() => {
      handleLongPress(id);
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
      navigate('/chat', { state: { contact } });
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const toggleRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          alert(`Audio recorded! Size: ${audioBlob.size} bytes. Ready to send.`);
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err: any) {
        alert('Microphone access disabled/error: ' + err.message);
      }
    }
  };

  const startGroupCall = (isVideo: boolean = true) => {
    const participants = Array.from(selectedIds);
    const roomId = `room-${Math.random().toString(36).substr(2, 9)}`;
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    navigate('/call', { 
      state: { 
        title: isVideo ? t('groupVideoCall') : t('voiceCall'), 
        isGroup: true, 
        isVideo: isVideo,
        participants, 
        roomId 
      } 
    });
  };

  // Find the ID of the last selected contact in the list
  const lastSelectedContactId = [...contacts].reverse().find(c => selectedIds.has(c.id))?.id;

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Prominent Full-Screen Overlay for Initial Interaction (Web Only) */}
      {isSupported && !Capacitor.isNativePlatform() && !hasAttemptedImport && contacts.length === 0 && (
        <button 
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm cursor-pointer border-none outline-none w-full h-full" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            importContacts();
          }}
        >
          <div className="bg-blue-600/20 p-6 rounded-full mb-6 animate-pulse">
            <Users className="w-16 h-16 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Load Contacts</h2>
          <p className="text-slate-300 text-center max-w-xs text-lg">
            Tap anywhere on the screen to securely import your real phone contacts.
          </p>
        </button>
      )}

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
      <div className="flex-1 overflow-y-auto pt-2">
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
        ) : isSupported === false ? (
          // Not Supported State
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Not Supported</h3>
            <p className="text-slate-400 mb-6">This feature requires a native device or mobile Chrome.</p>
          </div>
        ) : contacts.length === 0 ? (
          // Initial State / Empty State
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Users className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              {Capacitor.isNativePlatform() 
                ? (hasAttemptedImport ? 'Permission Denied or No Contacts' : 'Syncing Contacts...') 
                : 'No Saved Contacts Found'}
            </h3>
            <p className="text-slate-400 mb-6">
              {Capacitor.isNativePlatform() 
                ? 'Please ensure you have granted contacts permission in your device settings (Settings > Apps > Triosync > Permissions).'
                : 'Tap the button below to fetch and save your real phone contacts.'}
            </p>
            {!Capacitor.isNativePlatform() && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  importContacts();
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-bold transition-colors relative z-50"
              >
                Import Contacts from Phone
              </button>
            )}
            {Capacitor.isNativePlatform() && hasAttemptedImport && (
               <button 
               onClick={(e) => {
                 e.stopPropagation();
                 // Re-trigger the effect logic manually
                 setIsLoading(true);
                 Contacts.requestPermissions().then(perm => {
                   if(perm.contacts === 'granted') {
                     Contacts.getContacts({ projection: { name: true, phones: true } }).then(async res => {
                        const formattedContacts = res.contacts
                          .filter(c => c.name?.display && c.phones && c.phones.length > 0)
                          .map((c, i) => {
                            const name = c.name?.display || 'Unknown';
                            const phone = c.phones?.[0]?.number || 'No phone';
                            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                            return { id: i, name, phone, initials };
                          });
                        await syncContactsToSupabase(formattedContacts);
                        setContacts(formattedContacts);
                     });
                   }
                 }).finally(() => setIsLoading(false));
               }} 
               className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-bold transition-colors relative z-50 mt-4"
             >
               Retry Permission
             </button>
            )}
          </div>
        ) : (
          contacts.map((contact) => {
            const isSelected = selectedIds.has(contact.id);
            const avatarColor = getAvatarColor(contact.name);
            return (
            <React.Fragment key={contact.id}>
              <div
                onContextMenu={(e) => { e.preventDefault(); handleLongPress(contact.id); }}
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
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold mr-4 ${
                  isSelected ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' : `${avatarColor} text-white`
                }`}>
                  {isSelected ? <Check className="w-6 h-6" /> : contact.initials}
                </div>
                <div className="flex-1 border-b border-slate-800 pb-3 pt-1">
                  <h3 className="font-semibold text-slate-200 text-lg">{contact.name}</h3>
                  <p className="text-sm text-slate-400" dir="ltr">{contact.phone}</p>
                </div>
              </div>
            </React.Fragment>
          );
        }))}
      </div>

      {/* WhatsApp Style FAB for Group Call */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 right-6 z-30 animate-in zoom-in fade-in flex flex-col gap-4">
          <button
            onClick={() => startGroupCall(false)}
            className="bg-blue-500 hover:bg-blue-600 text-white w-14 h-14 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.5)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          >
            <Phone className="w-6 h-6" />
          </button>
          <button
            onClick={() => startGroupCall(true)}
            className="bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full shadow-[0_4px_12px_rgba(34,197,94,0.5)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          >
            <Video className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
