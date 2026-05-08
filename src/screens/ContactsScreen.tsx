import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, Video, Check, X, Mic, ChevronDown, Users, Loader2, Trash2, UserPlus, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useSelection } from '../contexts/SelectionContext';
import { useZego } from '../contexts/ZegoContext';
import { motion, AnimatePresence } from 'motion/react';

interface Contact { id: number; name: string; phone: string; initials: string; }

export default function ContactsScreen() {
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const { zp } = useZego();
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
  const [onlinePhones, setOnlinePhones] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const profileToPhoneRef = useRef<Map<string, string>>(new Map());

  useEffect(() => { localStorage.setItem('triosync_device_contacts', JSON.stringify(contacts)); }, [contacts]);

  useEffect(() => {
    let isMounted = true;
    const handleFetch = () => triggerContactFetch();
    window.addEventListener('fetch-contacts', handleFetch);

    let channel: any = null;
    let presenceChannel: any = null;

    const updatePresence = () => {
      if (!presenceChannel) return;
      const state = presenceChannel.presenceState();
      const onlineIds = Object.keys(state);
      const onlinePhonesSet = new Set<string>();
      onlineIds.forEach(id => {
        const phone = profileToPhoneRef.current.get(id);
        if (phone) onlinePhonesSet.add(phone);
      });
      setOnlinePhones(onlinePhonesSet);
    };

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
      profileToPhoneRef.current = profileToPhone;
      updatePresence();
      const { data: messages } = await supabase.from('messages').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: true });
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
    channel = supabase.channel('contacts_messages').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchChats()).subscribe();

    if (user) {
      presenceChannel = supabase.channel('global_presence');
      presenceChannel
        .on('presence', { event: 'sync' }, updatePresence)
        .on('presence', { event: 'join' }, updatePresence)
        .on('presence', { event: 'leave' }, updatePresence)
        .subscribe();
    }

    return () => { 
      isMounted = false; 
      window.removeEventListener('fetch-contacts', handleFetch); 
      if (channel) supabase.removeChannel(channel); 
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const newContact: Contact = { id: Date.now(), name: newContactName.trim(), phone: newContactPhone.trim(), initials: newContactName.trim().substring(0, 2).toUpperCase() };
    setContacts(prev => {
      const map = new Map(); prev.forEach(c => map.set(c.phone, c)); map.set(newContact.phone, newContact); return Array.from(map.values());
    });
    setNewContactName(''); setNewContactPhone(''); setShowAddForm(false);
  };

  const handleDeleteContact = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteContact') || `Are you sure you want to delete ${contact.name}?`)) {
      setContacts(prev => prev.filter(c => c.phone !== contact.phone));
      if (selectedContactIds.includes(contact.phone)) toggleSelection({ id: contact.phone, name: contact.name }, false);
    }
  };

  const triggerContactFetch = async () => {
    setIsLoadingContacts(true); setErrorMessage(null);
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Contacts.requestPermissions();
        if (perm.contacts === 'granted') {
          const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
          if (result.contacts && result.contacts.length > 0) {
            const mappedContacts = result.contacts.map((c, i) => ({ id: i, name: c.name?.display || 'Unknown', phone: c.phones?.[0]?.number || 'No phone', initials: (c.name?.display || 'U').substring(0, 2).toUpperCase() }));
            setContacts(prev => { const map = new Map(); prev.forEach(c => map.set(c.phone, c)); mappedContacts.forEach(c => map.set(c.phone, c)); return Array.from(map.values()); });
          } else setErrorMessage(t('noContactsFound') || 'No native contacts found.');
        } else setErrorMessage(t('permissionDenied') || 'Permission denied for contacts.');
      } else {
        if ('contacts' in navigator && 'ContactsManager' in window) {
          const webContacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
          if (webContacts && webContacts.length > 0) {
            const mappedContacts = webContacts.map((c: any, i: number) => { const name = c.name?.[0] || 'Unknown'; const phone = c.tel?.[0] || 'No phone'; return { id: i, name, phone, initials: name.substring(0, 2).toUpperCase() }; });
            setContacts(prev => { const map = new Map(); prev.forEach(c => map.set(c.phone, c)); mappedContacts.forEach(c => map.set(c.phone, c)); return Array.from(map.values()); });
          } else setErrorMessage(t('noContactsFound') || 'No contacts selected.');
        } else setErrorMessage(t('apiNotSupported') || 'Browser Contacts API unsupported.');
      }
    } catch (err) { setErrorMessage(t('loadFailed') || 'Failed to load contacts.'); }
    finally { setIsLoadingContacts(false); }
  };

  const handleTouchStart = (contact: Contact) => { longPressTimer.current = setTimeout(() => { if (!isSelectionMode) { toggleSelection({ id: contact.phone, name: contact.name }, true); setExpandedContactId(null); } }, 500); };
  const handleTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  const handleTap = (contact: Contact) => { if (isSelectionMode) toggleSelection({ id: contact.phone, name: contact.name }); else navigate('/chat', { state: { contact } }); };

  const startGroupCall = async (isVideo: boolean = true) => {
    if (!zp || selectedContactIds.length === 0) return;
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, phone');
      if (!profiles) return;
      const callees: any[] = [];
      
      // 💡 استخراج اسم المتصل (المضيف) من الذاكرة المحلية أو الإيميل
      let myName = user?.email ? user.email.split('@')[0] : 'المضيف';
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed.fullName) myName = parsed.fullName;
        } catch(e) {}
      }

      for (const phone of selectedContactIds) {
        const cleanPhone = phone.replace(/\D/g, '').slice(-9);
        const profile = profiles.find(p => p.phone && p.phone.replace(/\D/g, '').slice(-9) === cleanPhone);
        if (profile) {
          const targetZegoId = profile.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
          const contactObj = contacts.find(c => c.phone === phone);
          const contactName = contactObj?.name || 'مستخدم';
          
          callees.push({ userID: targetZegoId, userName: contactName });
          
          // 💡 التحديث: رسالة طبيعية وواضحة بدون ذكر اسم المستقبل
          const callIcon = isVideo ? '📹 مكالمة فيديو' : '📞 مكالمة صوتية';
          const content = `تم الاتصال بك ${callIcon} من طرف ${myName}`;

          // إرسال السجل الصامت
          await supabase.from('messages').insert({ 
            sender_id: user?.id, 
            receiver_id: profile.id, 
            content, 
            status: 'sent' 
          });
        }
      }

      if (callees.length > 0) {
        zp.sendCallInvitation({ callees, callType: isVideo ? 1 : 0, timeout: 60 }).catch(console.error);
        selectedContactIds.forEach(id => toggleSelection({ id, name: '' }, false));
      } else alert(t('noUsersFound') || 'No registered users found.');
    } catch (err) { console.error(err); }
  };

  const lastSelectedContactPhone = selectedContactIds.length > 0 ? selectedContactIds[selectedContactIds.length - 1] : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 relative" dir={dir}>
      <div className="px-4 py-3 flex justify-between items-center border-b border-slate-800/60 bg-slate-900 z-10 shadow-sm">
        <button onClick={() => triggerContactFetch()} className="flex items-center gap-2 text-[13px] font-semibold text-blue-400"><Users className="w-4 h-4" /> {t('loadContacts') || 'Load Contacts'}</button>
        <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 text-[13px] font-semibold text-blue-400"><UserPlus className="w-4 h-4" /> {t('addManual') || 'Add Manual'}</button>
      </div>
      <AnimatePresence>
        {showAddForm && (
          <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-800/50 border-b border-slate-800/60" onSubmit={handleManualAdd}>
            <div className="p-4 flex flex-col gap-3">
              <input type="text" placeholder={t('name') || 'Name'} value={newContactName} onChange={e => setNewContactName(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm outline-none" required />
              <input type="tel" placeholder={t('phone') || 'Phone'} value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm outline-none" required dir="ltr"/>
              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-400 text-sm">{t('cancel') || 'Cancel'}</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">{t('saveContact') || 'Save Contact'}</button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-y-auto pt-2 pb-20">
        {isLoadingContacts && <div className="flex flex-col items-center p-6 text-slate-400"><Loader2 className="w-8 h-8 animate-spin mb-2" /><span>{t('loading') || 'Loading...'}</span></div>}
        {contacts.map((contact) => {
            const isSelected = selectedContactIds.includes(contact.phone);
            const chatInfo = chatSummaries[contact.phone.replace(/\D/g, '').slice(-9)];
            return (
            <div key={`${contact.id}-${contact.phone}`} className="relative">
              <div onMouseDown={() => handleTouchStart(contact)} onMouseUp={handleTouchEnd} onTouchStart={() => handleTouchStart(contact)} onTouchEnd={handleTouchEnd} onClick={() => handleTap(contact)} className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-[#0070a8]' : 'hover:bg-slate-800/50'}`}>
                <div className="relative mx-4 shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${isSelected ? 'bg-[#00b4d8] text-white' : 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30'}`}>{isSelected ? <Check className="w-6 h-6" /> : contact.initials}</div>
                  {onlinePhones.has(contact.phone.replace(/\D/g, '').slice(-9)) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  )}
                </div>
                
                {/* 💡 التحديث الأساسي: عزل منطقة الاسم والرقم لتبقى متناسقة ولا تنعكس */}
                <div className="flex-1 border-b border-slate-800/60 pb-3 flex justify-between items-center px-2 min-w-0" dir="ltr">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex justify-between items-baseline mb-0.5 min-w-0 gap-2">
                      <h3 className={`font-semibold text-[17px] truncate flex-1 text-left ${isSelected ? 'text-white' : 'text-slate-200'}`}>{contact.name}</h3>
                      {chatInfo?.lastTime && <span className="text-[11px] text-slate-500">{new Date(chatInfo.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                    <p className="text-[14px] truncate text-slate-400 text-left">{chatInfo?.lastMessage ? (chatInfo.lastMessage.startsWith('File: ') ? (t('attachment') || '📎 Attachment') : chatInfo.lastMessage) : contact.phone}</p>
                  </div>
                  {chatInfo && chatInfo.unreadCount > 0 && !isSelectionMode && <div className="bg-blue-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{chatInfo.unreadCount}</div>}
                  
                  {!isSelectionMode && (
                    <button 
                      onClick={(e) => handleDeleteContact(e, contact)}
                      className="ml-2 p-2 text-slate-500 hover:text-red-500 hover:bg-slate-800 rounded-full transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <AnimatePresence>
                {isSelectionMode && contact.phone === lastSelectedContactPhone && (
                  <motion.div layoutId="dynamic-fab" className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <button onClick={(e) => { e.stopPropagation(); startGroupCall(false); }} className="w-[48px] h-[48px] rounded-full bg-[#00b4d8] text-white flex items-center justify-center shadow-lg"><Phone className="w-5 h-5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); startGroupCall(true); }} className="w-[48px] h-[48px] rounded-full bg-[#00e676] text-white flex items-center justify-center shadow-lg"><Video className="w-5 h-5" /></button>
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
