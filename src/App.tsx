import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import * as Peer from "simple-peer";
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  ScreenShare, 
  Layout, 
  Maximize2, 
  Users, 
  Settings, 
  LogOut,
  Monitor,
  Grid,
  Radio,
  Phone,
  Search,
  Plus,
  MessageSquare,
  UserPlus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  Share2,
  Globe,
  Lock,
  ArrowLeft,
  ArrowRight,
  Send,
  Languages,
  Home,
  Pin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { supabase } from "./supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { parsePhoneNumberFromString, CountryCode, getCountries, getCountryCallingCode } from 'libphonenumber-js';
import ChatScreen from './components/ChatScreen';

function getFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const ALL_COUNTRIES = getCountries().map(country => ({
  country,
  name: regionNames.of(country) || country,
  code: getCountryCallingCode(country),
  flag: getFlagEmoji(country)
})).sort((a, b) => a.name.localeCompare(b.name));

const PeerConstructor = (Peer as any).default || Peer;

interface PeerState {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
}

type ContentType = "video" | "youtube" | "pdf" | "search" | "image";

interface ScreenContent {
  type: ContentType;
  src: string; // URL or peerId
}

const VideoComponent = ({ stream, muted = false, name = "Participant" }: { stream?: MediaStream, muted?: boolean, name?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden shadow-lg group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-white text-xs font-medium">
        {name}
      </div>
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
            <Users className="w-8 h-8 text-slate-500" />
          </div>
        </div>
      )}
    </div>
  );
};

const badgeColors = [
  "bg-red-500", "bg-blue-500", "bg-emerald-500", 
  "bg-amber-500", "bg-purple-500", "bg-pink-500"
];

const ContentComponent = ({ 
  content, 
  peers, 
  userStream, 
  userName, 
  index,
  muted = false 
}: { 
  content: ScreenContent, 
  peers: PeerState[], 
  userStream: MediaStream | null,
  userName: string,
  index?: number,
  muted?: boolean
}) => {
  const screenNumber = index !== undefined ? index + 1 : null;
  const badgeColor = screenNumber ? badgeColors[(screenNumber - 1) % badgeColors.length] : "bg-blue-600";

  if (content.type === "video") {
    const isMe = content.src === "me";
    const peer = peers.find(p => p.peerId === content.src);
    const stream = isMe ? userStream : peer?.stream;
    const name = isMe ? `${userName} (You)` : peer ? `Guest ${peer.peerId.slice(0, 4)}` : "Empty Slot";
    return (
      <div className="w-full h-full relative">
        <VideoComponent stream={stream || undefined} muted={isMe || muted} name={name} />
        {screenNumber && (
          <div className={cn("absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-20", badgeColor)}>
            {screenNumber}
          </div>
        )}
      </div>
    );
  }

  if (content.type === "youtube") {
    // Extract video ID if it's a full URL
    let videoId = content.src;
    try {
      const url = new URL(content.src);
      if (url.hostname.includes("youtube.com")) videoId = url.searchParams.get("v") || "";
      if (url.hostname.includes("youtu.be")) videoId = url.pathname.slice(1);
    } catch (e) {}
    
    return (
      <div className="w-full h-full bg-black rounded-xl overflow-hidden relative">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="w-full h-full border-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <div className="absolute bottom-3 left-3 px-2 py-1 bg-red-600/80 backdrop-blur-md rounded-md text-white text-[10px] font-bold uppercase">
          YouTube
        </div>
        {screenNumber && (
          <div className={cn("absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-20", badgeColor)}>
            {screenNumber}
          </div>
        )}
      </div>
    );
  }

  if (content.type === "pdf" || content.type === "search") {
    return (
      <div className="w-full h-full bg-white rounded-xl overflow-hidden relative">
        <iframe
          src={content.src}
          className="w-full h-full border-none"
          title="Content Frame"
        />
        <div className="absolute bottom-3 left-3 px-2 py-1 bg-blue-600/80 backdrop-blur-md rounded-md text-white text-[10px] font-bold uppercase">
          {content.type === "pdf" ? "Document" : "Web Search"}
        </div>
        {screenNumber && (
          <div className={cn("absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-20", badgeColor)}>
            {screenNumber}
          </div>
        )}
      </div>
    );
  }

  if (content.type === "image") {
    return (
      <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden relative">
        <img
          src={content.src}
          alt="Content"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
        />
        <div className="absolute bottom-3 left-3 px-2 py-1 bg-emerald-600/80 backdrop-blur-md rounded-md text-white text-[10px] font-bold uppercase">
          Image
        </div>
        {screenNumber && (
          <div className={cn("absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-20", badgeColor)}>
            {screenNumber}
          </div>
        )}
      </div>
    );
  }

  return <div className="w-full h-full bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">No Content</div>;
};



export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(ALL_COUNTRIES[0].country);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [appMode, setAppMode] = useState<"contacts" | "private-room" | "broadcast">("contacts");
  const [activeChatUser, setActiveChatUser] = useState<any>(null);
  
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("main-room");
  const [userName, setUserName] = useState("");
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "three-screen" | "live">("grid");
  
  // Contact State
  const [contacts, setContacts] = useState<any[]>([
    { id: '1', display_name: 'Ahmed Ali', phone_number: '+966 50 123 4567', photo_url: 'https://picsum.photos/seed/ahmed/200' },
    { id: '2', display_name: 'Sara Khalid', phone_number: '+966 55 987 6543', photo_url: 'https://picsum.photos/seed/sara/200' },
    { id: '3', display_name: 'Mohammed Omar', phone_number: '+966 54 321 0987', photo_url: 'https://picsum.photos/seed/mohammed/200' },
    { id: '4', display_name: 'Fatima Zahra', phone_number: '+212 60 111 2222', photo_url: 'https://picsum.photos/seed/fatima/200' }
  ]);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactActionModal, setContactActionModal] = useState<any>(null);
  const pressTimerRef = useRef<any>(null);

  // Main Navigation State
  const [mainTab, setMainTab] = useState<"home" | "notifications" | "profile">("home");

  // Broadcast State
  const [broadcastCategory, setBroadcastCategory] = useState("");
  const [broadcastTopic, setBroadcastTopic] = useState("");
  const [broadcastSearch, setBroadcastSearch] = useState("");
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([
    { id: 1, topic: "Cold War History", category: "politics", host: "Dr. Smith", viewers: "1.2k" },
    { id: 2, topic: "React 19 Features", category: "technology", host: "Jane Doe", viewers: "850" },
    { id: 3, topic: "World Cup Finals", category: "sports", host: "Sports TV", viewers: "5.4k" }
  ]);

  const filteredBroadcasts = activeBroadcasts.filter(b => 
    b.topic.toLowerCase().includes(broadcastSearch.toLowerCase()) ||
    b.category.toLowerCase().includes(broadcastSearch.toLowerCase())
  );

  // Notifications & Profile
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, text: "Ahmed Ali invited you to a private room", time: "2 min ago", unread: true },
    { id: 2, text: "Your broadcast 'React 19 Features' has ended", time: "1 hour ago", unread: false }
  ]);

  // Advanced Screen State
  const [screens, setScreens] = useState<ScreenContent[]>([
    { type: "video", src: "me" },
    { type: "video", src: "" },
    { type: "video", src: "" }
  ]);
  const screensRef = useRef(screens);
  useEffect(() => {
    screensRef.current = screens;
  }, [screens]);

  useEffect(() => {
    if (!isCreatorRef.current) return;
    
    setScreens(prev => {
      const newScreens = [...prev];
      let changed = false;
      // Remove peers that left
      newScreens.forEach((screen, idx) => {
        if (screen.type === "video" && screen.src !== "me" && screen.src !== "") {
          const peerExists = peers.some(p => p.peerId === screen.src);
          if (!peerExists) {
            newScreens[idx] = { type: "video", src: "" };
            changed = true;
          }
        }
      });
      return changed ? newScreens : prev;
    });
  }, [peers]);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [showPicker, setShowPicker] = useState<number | null>(null);
  const [pickerUrl, setPickerUrl] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<PeerState[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth session timeout - forcing loading to false");
        setLoading(false);
      }
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(timeout);
    }).catch(err => {
      console.error("Session error:", err);
      setLoading(false);
      clearTimeout(timeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          setUserData(data);
          setUserName(data.display_name);
          setIsRegistering(false);
        } else {
          setUserData((prev: any) => {
            if (!prev) setIsRegistering(true);
            return prev;
          });
        }
      };
      fetchUserData();

      // Real-time profile updates
      const channel = supabase
        .channel('profile-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload: any) => {
          if (payload.new) {
            setUserData(payload.new);
            setUserName(payload.new.display_name);
            setIsRegistering(false);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setUserData(null);
      setUserName("");
    }
  }, [user]);

  useEffect(() => {
    if (userData?.contacts?.length > 0) {
      const fetchContacts = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userData.contacts);
        
        if (data) setContacts(data);
      };
      fetchContacts();
    } else {
      setContacts([]);
    }
  }, [userData?.contacts]);

  const handleSendCode = async () => {
    if (!userName.trim()) {
      alert(language === "ar" ? "الرجاء إدخال اسمك" : "Please enter your name");
      return;
    }
    if (!phoneNumber) {
      alert(`Please enter your phone number to continue.`);
      return;
    }

    try {
      let deviceContacts: any[] = [];
      if ('contacts' in navigator && 'ContactsManager' in window) {
        try {
          const props = ['name', 'tel'];
          const opts = { multiple: true };
          // @ts-ignore
          deviceContacts = await navigator.contacts.select(props, opts);
        } catch (err) {
          console.warn("Could not auto-sync contacts:", err);
        }
      }

      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber, selectedCountry);
      if (!phoneNumberObj || !phoneNumberObj.isValid() || phoneNumberObj.country !== selectedCountry) {
        alert(language === 'ar' ? "الرجاء إدخال رقم هاتف صحيح تابع للدولة المحددة." : "Please enter a valid phone number for the selected country.");
        return;
      }

      const fullPhoneNumber = phoneNumberObj.number;
      setIsSubmitting(true);

      let authUser = null;
      const email = `${fullPhoneNumber.replace('+', '')}@phone-auth.local`;
      const password = `PhoneAuth123!${fullPhoneNumber}`;
      
      let { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError && signInError.message.includes("Invalid login credentials")) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              phone: fullPhoneNumber
            }
          }
        });
        if (signUpError) throw signUpError;
        
        if (signUpData.user && !signUpData.session) {
           const errMsg = language === "ar" 
             ? "يجب إيقاف خيار 'تأكيد البريد الإلكتروني' (Confirm email) في إعدادات Supabase Auth لكي يعمل هذا الدخول المباشر، أو قم بإعداد مزود رسائل SMS حقيقي."
             : "Email confirmation is required in your Supabase project. Please disable 'Confirm email' in Supabase Auth settings to use this fallback, or configure a real Phone Provider.";
           throw new Error(errMsg);
        }
        authUser = signUpData.user;
      } else if (signInError) {
        throw signInError;
      } else {
        authUser = data.user;
      }

      if (authUser) {
        const newProfile = {
          id: authUser.id,
          phone_number: fullPhoneNumber,
          display_name: userName,
          photo_url: `https://picsum.photos/seed/${authUser.id}/200`,
          updated_at: new Date().toISOString()
        };
        const { data: updatedProfile, error: profileError } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select()
          .single();
        
        if (profileError) {
          console.error("Error creating profile:", profileError);
          // Fallback to local state if RLS prevents upsert so user isn't stuck
          setUser(authUser);
          setUserData(newProfile);
          setIsRegistering(false);
        } else {
          setUser(authUser);
          setUserData(updatedProfile || newProfile);
          setIsRegistering(false);
        }

        // Process contacts if we got them
        if (deviceContacts.length > 0) {
          const phoneNumbers = deviceContacts.flatMap((c: any) => c.tel || []).map((t: string) => {
            const cleaned = t.replace(/[\s-()]/g, '');
            const parsed = parsePhoneNumberFromString(cleaned, selectedCountry);
            return parsed && parsed.isValid() ? parsed.number : cleaned;
          });
          if (phoneNumbers.length > 0) {
            const { data: contactData } = await supabase
              .from('profiles')
              .select('id')
              .in('phone_number', phoneNumbers);
              
            if (contactData && contactData.length > 0) {
              const newContactIds = contactData.map(d => d.id);
              await supabase
                .from('profiles')
                .update({ contacts: newContactIds })
                .eq('id', authUser.id);
                
              setUserData((prev: any) => prev ? { ...prev, contacts: newContactIds } : prev);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error logging in:", error);
      
      let errorMessage = error.message || "Failed to log in.";
      if (errorMessage.includes("NetworkError") || errorMessage.includes("Failed to fetch")) {
        errorMessage = "Network Error: Could not connect to Supabase. Please check if your Supabase project is paused, or if your Supabase URL and Anon Key are correct in src/supabase.ts.";
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const t = {
    en: {
      welcome: "Welcome",
      verifyCode: "Verify Code",
      createProfile: "Create Profile",
      enterDetails: "Enter your name and phone number",
      enterCode: "Enter the 6-digit code",
      tellName: "Tell us your name",
      email: "Email (Recommended)",
      phone: "Phone",
      phoneNumber: "Phone Number",
      emailLabel: "Email Address",
      startNow: "START",
      quickStart: "QUICK START (DEMO)",
      noSetup: "No Setup Required",
      broadcastConsole: "Broadcast Console",
      meetingRoom: "Meeting Room",
      enterRoomId: "Enter a room ID or join a contact",
      roomId: "Room ID",
      joinRoom: "Join Room",
      directCall: "Direct Call",
      contacts: "Contacts",
      searchContacts: "Search Contacts",
      addContact: "Add Contact",
      syncContacts: "Sync Device Contacts",
      online: "Online",
      offline: "Offline",
      logout: "Logout",
      displayName: "Display Name",
      completeRegistration: "Complete Registration",
      inviteLink: "Invite link copied to clipboard!",
      skipAuth: "Taking too long? Click here to bypass",
      processing: "Processing...",
      enterRoomPlaceholder: "e.g. marketing-sync",
      call: "Call",
      cancel: "Cancel",
      enterPhoneToCall: "Enter phone number to call",
      searchPhone: "Search phone...",
      search: "Search",
      noContacts: "No contacts yet. Add friends by their phone number.",
      liveSession: "Live Session",
      inviteLinkBtn: "Invite Link",
      leave: "Leave",
      grid: "Grid",
      threeScreen: "Three Screen",
      live: "Live",
      profile: "Profile",
      notifications: "Notifications",
      home: "Home",
      privateRoom: "Private Room",
      broadcast: "Broadcast",
      subscriptionInfo: "Subscription Info",
      activePlan: "Active Plan",
      free: "Free",
      pro: "Pro",
      category: "Category",
      topic: "Topic",
      searchTopic: "Search topics...",
      startBroadcast: "Start Broadcast",
      voiceMessage: "Voice Message",
      chat: "Chat",
      inviteToRoom: "Invite to Room",
      shareLink: "Share this link with others to join your room",
      politics: "Politics",
      technology: "Technology",
      sports: "Sports",
      entertainment: "Entertainment",
      noBroadcasts: "No live broadcasts found for this topic.",
      mainDisplay: "Main Display",
      participants: "Participants",
      switchScreen: "Switch Screen"
    },
    ar: {
      welcome: "أهلاً بك",
      verifyCode: "تحقق من الرمز",
      createProfile: "إنشاء ملف شخصي",
      enterDetails: "أدخل اسمك ورقم هاتفك",
      enterCode: "أدخل الرمز المكون من 6 أرقام",
      tellName: "أخبرنا باسمك",
      email: "البريد الإلكتروني (موصى به)",
      phone: "الهاتف",
      phoneNumber: "رقم الهاتف",
      emailLabel: "عنوان البريد الإلكتروني",
      startNow: "ابدأ",
      quickStart: "بدء سريع (تجريبي)",
      noSetup: "لا يتطلب إعداد",
      broadcastConsole: "لوحة البث",
      meetingRoom: "غرفة الاجتماعات",
      enterRoomId: "أدخل معرف الغرفة أو انضم لجهة اتصال",
      roomId: "معرف الغرفة",
      joinRoom: "انضمام للغرفة",
      directCall: "اتصال مباشر",
      contacts: "جهات الاتصال",
      searchContacts: "البحث عن جهات اتصال",
      addContact: "إضافة جهة اتصال",
      syncContacts: "مزامنة جهات الاتصال",
      online: "متصل",
      offline: "غير متصل",
      logout: "تسجيل الخروج",
      displayName: "الاسم",
      completeRegistration: "إكمال التسجيل",
      inviteLink: "تم نسخ رابط الدعوة!",
      skipAuth: "يستغرق وقتاً طويلاً؟ اضغط هنا للتجاوز",
      processing: "جاري المعالجة...",
      enterRoomPlaceholder: "مثال: اجتماع-فريق",
      call: "اتصال",
      cancel: "إلغاء",
      enterPhoneToCall: "أدخل رقم الهاتف للاتصال",
      searchPhone: "بحث عن هاتف...",
      search: "بحث",
      noContacts: "لا توجد جهات اتصال بعد. أضف أصدقاء برقم هاتفهم.",
      liveSession: "جلسة مباشرة",
      inviteLinkBtn: "رابط الدعوة",
      leave: "مغادرة",
      grid: "شبكة",
      threeScreen: "ثلاث شاشات",
      live: "مباشر",
      profile: "الملف الشخصي",
      notifications: "التنبيهات",
      home: "الرئيسية",
      privateRoom: "غرفة خاصة",
      broadcast: "بث مباشر",
      subscriptionInfo: "معلومات الاشتراك",
      activePlan: "الخطة الحالية",
      free: "مجاني",
      pro: "احترافي",
      category: "المجال",
      topic: "الموضوع",
      searchTopic: "البحث عن مواضيع...",
      startBroadcast: "بدء البث",
      voiceMessage: "رسالة صوتية",
      chat: "دردشة",
      inviteToRoom: "دعوة للغرفة",
      shareLink: "شارك هذا الرابط مع الآخرين للانضمام لغرفتك",
      politics: "سياسة",
      technology: "تكنولوجيا",
      sports: "رياضة",
      entertainment: "ترفيه",
      noBroadcasts: "لا يوجد بث مباشر لهذا الموضوع حالياً.",
      mainDisplay: "الشاشة الرئيسية",
      participants: "المشاركون",
      switchScreen: "تغيير الشاشة"
    }
  }[language];

  const toggleLanguage = () => {
    setLanguage(prev => prev === "en" ? "ar" : "en");
  };

  const handleSearchContact = async () => {
    if (!searchPhone) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_number', searchPhone)
        .single();

      if (data) {
        setSearchResult(data);
      } else {
        setSearchResult(null);
        alert("User not found.");
      }
    } catch (err) {
      console.error("Error searching contact:", err);
    }
  };

  const handleAddContact = async (contactId: string) => {
    if (!user || !userData) return;
    try {
      const newContacts = [...(userData.contacts || []), contactId];
      const { error } = await supabase
        .from('profiles')
        .update({ contacts: newContacts })
        .eq('id', user.id);
      
      if (error) throw error;
      setSearchResult(null);
      setSearchPhone("");
      alert("Contact added!");
    } catch (err) {
      console.error("Error adding contact:", err);
    }
  };

  const handleSyncContacts = async (userIdOverride?: string, currentContactsOverride?: string[], silent = false) => {
    const activeUserId = userIdOverride || user?.id;
    const activeContacts = currentContactsOverride || userData?.contacts || [];

    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      if (!silent) alert(language === 'ar' ? "عذراً، متصفحك أو جهازك (مثل الآيفون أو الكمبيوتر) لا يسمح بقراءة جهات الاتصال. هذه الميزة تعمل فقط على أجهزة أندرويد (متصفح Chrome)." : "Your browser or device (like iPhone/Desktop) does not support reading contacts. This feature only works on Android Chrome.");
      return;
    }
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      // @ts-ignore
      const deviceContacts = await navigator.contacts.select(props, opts);
      
      const userPhoneObj = userData?.phone_number ? parsePhoneNumberFromString(userData.phone_number) : null;
      const parseCountry = userPhoneObj?.country || selectedCountry;

      const phoneNumbers = deviceContacts.flatMap((c: any) => c.tel || []).map((t: string) => {
        const cleaned = t.replace(/[\s-()]/g, '');
        const parsed = parsePhoneNumberFromString(cleaned, parseCountry);
        return parsed && parsed.isValid() ? parsed.number : cleaned;
      });
      
      if (phoneNumbers.length === 0) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .in('phone_number', phoneNumbers);
        
      if (data && data.length > 0) {
        const newContactIds = data.map(d => d.id);
        const mergedContacts = Array.from(new Set([...activeContacts, ...newContactIds]));
        
        await supabase
          .from('profiles')
          .update({ contacts: mergedContacts })
          .eq('id', activeUserId);
          
        setUserData((prev: any) => prev ? { ...prev, contacts: mergedContacts } : prev);
          
        if (!silent) alert(language === 'ar' ? `تم جلب ${newContactIds.length} جهة اتصال بنجاح!` : `Synced ${newContactIds.length} contacts!`);
      } else {
        if (!silent) alert(language === 'ar' ? "لم يتم العثور على أي من جهات اتصالك مسجلاً في التطبيق." : "No registered contacts found from your device.");
      }
    } catch (ex) {
      console.error(ex);
      if (!silent) alert(language === 'ar' ? "فشل في جلب جهات الاتصال. تأكد من إعطاء الصلاحية للمتصفح." : "Failed to sync contacts. Ensure browser permissions are granted.");
    }
  };

  const handlePressStart = (contactId: string) => {
    pressTimerRef.current = setTimeout(() => {
      setSelectionMode(true);
      if (!selectedContactIds.includes(contactId)) {
        setSelectedContactIds(prev => [...prev, contactId]);
      }
    }, 500);
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
  };

  const handleContactClick = (contact: any) => {
    if (selectionMode) {
      setSelectedContactIds(prev => 
        prev.includes(contact.id) ? prev.filter(id => id !== contact.id) : [...prev, contact.id]
      );
    } else {
      setSelectedContact(selectedContact?.id === contact.id ? null : contact);
    }
  };

  const startGroupCall = () => {
    if (selectedContactIds.length === 0) return;
    const generatedRoomId = [user?.id, ...selectedContactIds].sort().join("-");
    setRoomId(generatedRoomId);
    joinRoom(generatedRoomId);
    setSelectionMode(false);
    setSelectedContactIds([]);
  };

  const startCallWithContact = (contact: any) => {
    const generatedRoomId = [user?.id, contact.id].sort().join("-");
    setRoomId(generatedRoomId);
    joinRoom(generatedRoomId);
  };

  const [showDirectCall, setShowDirectCall] = useState(false);
  const [directPhone, setDirectPhone] = useState("");

  const handleDirectCall = async () => {
    if (!directPhone) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_number', directPhone)
        .single();

      if (data) {
        startCallWithContact(data);
        setShowDirectCall(false);
      } else {
        alert("User not found.");
      }
    } catch (err) {
      console.error("Error starting direct call:", err);
    }
  };

  const [isCreator, setIsCreator] = useState(false);
  const isCreatorRef = useRef(isCreator);
  useEffect(() => {
    isCreatorRef.current = isCreator;
  }, [isCreator]);
  const isJoiningRef = useRef(false);

  const joinRoom = async (customRoomId?: string, isCreating: boolean = false) => {
    if (isJoiningRef.current || joined) return;
    isJoiningRef.current = true;
    
    let targetRoomId = customRoomId || roomId;
    if (isCreating) {
      targetRoomId = Math.random().toString(36).substring(2, 9);
      setRoomId(targetRoomId);
      setIsCreator(true);
      const url = `${window.location.origin}?room=${targetRoomId}`;
      navigator.clipboard.writeText(url);
      alert("Room created! Invite link copied to clipboard.");
    } else if (customRoomId) {
      setRoomId(customRoomId);
      setIsCreator(false);
    }

    if (!userName) {
      isJoiningRef.current = false;
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setUserStream(stream);
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      socketRef.current = io("/");
      socketRef.current.emit("join-room", targetRoomId);

      socketRef.current.on("screens-updated", (newScreens: ScreenContent[]) => {
        if (!isCreatorRef.current) {
          setScreens(newScreens);
        }
      });

      socketRef.current.on("all-users", (users: string[]) => {
        const newPeers: PeerState[] = [];
        users.forEach(userId => {
          const peer = createPeer(userId, socketRef.current!.id!, stream);
          peersRef.current.push({ peerId: userId, peer });
          newPeers.push({ peerId: userId, peer });
        });
        setPeers(newPeers);
      });

      socketRef.current.on("user-joined", (payload: { signal: any, callerId: string }) => {
        if (isCreatorRef.current) {
          socketRef.current?.emit("sync-screens", { roomId: targetRoomId, screens: screensRef.current });
        }
        const existingPeerIndex = peersRef.current.findIndex(p => p.peerId === payload.callerId);
        if (existingPeerIndex !== -1) {
          try {
            peersRef.current[existingPeerIndex].peer.destroy();
          } catch (e) {}
          peersRef.current.splice(existingPeerIndex, 1);
        }

        const peer = addPeer(payload.signal, payload.callerId, stream);
        const peerObj = { peerId: payload.callerId, peer };
        peersRef.current.push(peerObj);
        setPeers(prev => {
          const filtered = prev.filter(p => p.peerId !== payload.callerId);
          return [...filtered, peerObj];
        });
      });

      socketRef.current.on("receiving-returned-signal", (payload: { signal: any, id: string }) => {
        const item = peersRef.current.find(p => p.peerId === payload.id);
        if (item && !item.peer.destroyed) {
          try {
            item.peer.signal(payload.signal);
          } catch (err) {
            console.error("Error signaling peer:", err);
          }
        }
      });

      socketRef.current.on("user-left", (id: string) => {
        const peerObj = peersRef.current.find(p => p.peerId === id);
        if (peerObj) peerObj.peer.destroy();
        const filteredPeers = peersRef.current.filter(p => p.peerId !== id);
        peersRef.current = filteredPeers;
        setPeers(filteredPeers);
      });

      setJoined(true);
      isJoiningRef.current = false;
    } catch (err) {
      console.error("Error accessing media devices:", err);
      isJoiningRef.current = false;
    }
  };

  const createPeer = (userToSignal: string, callerId: string, stream: MediaStream) => {
    const peer = new PeerConstructor({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("error", err => {
      console.warn("Peer error (createPeer):", err);
    });

    peer.on("signal", signal => {
      socketRef.current?.emit("sending-signal", { userToSignal, callerId, signal });
    });

    peer.on("stream", stream => {
      setPeers(prev => prev.map(p => p.peerId === userToSignal ? { ...p, stream } : p));
    });

    return peer;
  };

  const addPeer = (incomingSignal: any, callerId: string, stream: MediaStream) => {
    const peer = new PeerConstructor({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("error", err => {
      console.warn("Peer error (addPeer):", err);
    });

    peer.on("signal", signal => {
      socketRef.current?.emit("returning-signal", { signal, callerId });
    });

    peer.on("stream", stream => {
      setPeers(prev => prev.map(p => p.peerId === callerId ? { ...p, stream } : p));
    });

    if (!peer.destroyed) {
      try {
        peer.signal(incomingSignal);
      } catch (err) {
        console.error("Error signaling new peer:", err);
      }
    }

    return peer;
  };

  const toggleMic = () => {
    if (userStream) {
      userStream.getAudioTracks()[0].enabled = !micOn;
      setMicOn(!micOn);
    }
  };

  const toggleVideo = () => {
    if (userStream) {
      userStream.getVideoTracks()[0].enabled = !videoOn;
      setVideoOn(!videoOn);
    }
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    alert("Invite link copied to clipboard!");
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  useEffect(() => {
    if (joined && isCreator && socketRef.current) {
      socketRef.current.emit("sync-screens", { roomId, screens });
    }
  }, [screens, isCreator, joined, roomId]);

  const leaveRoom = () => {
    socketRef.current?.disconnect();
    userStream?.getTracks().forEach(track => track.stop());
    setJoined(false);
    setIsCreator(false);
    setPeers([]);
    peersRef.current = [];
    setScreens([
      { type: "video", src: "me" },
      { type: "video", src: "" },
      { type: "video", src: "" }
    ]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <button 
          onClick={() => setLoading(false)}
          className="text-slate-500 text-xs hover:text-white transition-colors underline"
        >
          {t.skipAuth}
        </button>
      </div>
    );
  }

  if ((!user && !isDemoMode) || (isRegistering && !isDemoMode)) {
    return (
      <div className={cn("min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans", language === "ar" ? "rtl" : "ltr")}>
        <div id="recaptcha-container"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative"
        >
          {/* Language Switcher */}
          <button 
            onClick={toggleLanguage}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-2 text-xs font-bold"
          >
            <Languages className="w-4 h-4" />
            {language === "en" ? "AR" : "EN"}
          </button>

          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {t.welcome}
            </h1>
            <p className="text-slate-400 text-sm mt-1 text-center">
              {t.enterDetails}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t.displayName}</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all mb-4"
                placeholder={language === "ar" ? "مثال: أحمد" : "e.g. John Doe"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t.phoneNumber}</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 z-10 flex items-center">
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value as CountryCode)}
                    className="appearance-none bg-transparent text-2xl cursor-pointer focus:outline-none"
                    style={{ width: '40px' }}
                  >
                    {ALL_COUNTRIES.map(c => (
                      <option key={c.country} value={c.country} className="text-base text-slate-900">
                        {c.flag}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-16 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="1234567890"
                />
              </div>
            </div>
            
            <button
              onClick={handleSendCode}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              {isSubmitting ? "Logging in..." : t.startNow}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (activeChatUser) {
    return (
      <ChatScreen 
        currentUser={userData || user} 
        contact={activeChatUser} 
        onClose={() => setActiveChatUser(null)} 
        language={language}
      />
    );
  }

  if (!joined) {
    return (
      <div className={cn("min-h-screen bg-slate-950 flex flex-col font-sans", language === "ar" ? "rtl" : "ltr")}>
        {/* Top Bar */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Video className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-white font-bold tracking-tight hidden sm:block">{t.broadcastConsole}</h1>
          </div>

          {/* Main Tabs */}
          <div className="flex items-center bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
            <button 
              onClick={() => {
                setMainTab("home");
                if (appMode === "contacts" && (!userData?.contacts || userData.contacts.length === 0)) {
                  handleSyncContacts(user?.id, userData?.contacts, false);
                }
              }}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", mainTab === "home" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
            >
              <Home className="w-4 h-4" />
              <span className="hidden md:inline">{t.home}</span>
            </button>
            <button 
              onClick={() => setMainTab("notifications")}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", mainTab === "notifications" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
            >
              <Bell className="w-4 h-4" />
              <span className="hidden md:inline">{t.notifications}</span>
              {notifications.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full ml-1" />}
            </button>
            <button 
              onClick={() => setMainTab("profile")}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", mainTab === "profile" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline">{t.profile}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleLanguage}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all text-xs font-bold"
            >
              {language === "en" ? "AR" : "EN"}
            </button>

            <button 
              onClick={() => {
                supabase.auth.signOut();
                setIsDemoMode(false);
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {mainTab === "profile" && (
            <div className="max-w-2xl mx-auto w-full h-full flex flex-col items-center justify-center">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl w-full text-center">
                <img src={userData?.photo_url} alt="" className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-slate-800 shadow-xl" />
                <h3 className="text-white font-bold text-3xl mb-2">{userData?.display_name}</h3>
                <p className="text-slate-400 text-lg mb-8">{userData?.phone_number || userData?.email}</p>
                
                <div className="space-y-6 max-w-sm mx-auto">
                  <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-left">
                    <h4 className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-4">{t.subscriptionInfo}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-medium">{t.activePlan}</span>
                      <span className="px-3 py-1.5 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg uppercase">{t.free}</span>
                    </div>
                  </div>
                  <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20">
                    Upgrade to Pro
                  </button>
                </div>
              </div>
            </div>
          )}

          {mainTab === "notifications" && (
            <div className="max-w-3xl mx-auto w-full h-full flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">{t.notifications}</h2>
              </div>
              
              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-8">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <Bell className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-lg">No new notifications</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="p-5 bg-slate-900 rounded-2xl border border-slate-800 shadow-lg flex items-start gap-4">
                      <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0" />
                      <div>
                        <p className="text-slate-200 text-base">{n.text || n.message}</p>
                        <span className="text-xs text-slate-500 mt-2 block">{n.time || new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {mainTab === "home" && (
            <div className="h-full flex flex-col">
              {/* Mode Switcher inside Home */}
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                  <button 
                    onClick={() => {
                      setAppMode("contacts");
                      if (!userData?.contacts || userData.contacts.length === 0) {
                        handleSyncContacts(user?.id, userData?.contacts, false);
                      }
                    }}
                    className={cn("px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2", appMode === "contacts" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                  >
                    <span>{t.contacts}</span>
                  </button>
                  <button 
                    onClick={() => setAppMode("private-room")}
                    className={cn("px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2", appMode === "private-room" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                  >
                    <Lock className="w-5 h-5" />
                    <span>{t.privateRoom}</span>
                  </button>
                  <button 
                    onClick={() => setAppMode("broadcast")}
                    className={cn("px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2", appMode === "broadcast" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800")}
                  >
                    <Globe className="w-5 h-5" />
                    <span>{t.broadcast}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {appMode === "contacts" && (
                  <div className="h-full flex flex-col max-w-4xl mx-auto">
                    {selectionMode && (
                      <div className="flex justify-end mb-4 gap-2">
                        <button 
                          onClick={() => { setSelectionMode(false); setSelectedContactIds([]); }}
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all border border-slate-700"
                        >
                          {t.cancel}
                        </button>
                        {selectedContactIds.length > 0 && (
                          <button 
                            onClick={startGroupCall}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                          >
                            <Video className="w-4 h-4" />
                            Group Call ({selectedContactIds.length})
                          </button>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-8">
                      {contacts.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-500">
                          <p className="text-lg font-medium mb-2">{language === 'ar' ? "لا توجد جهات اتصال" : "No contacts found"}</p>
                          <p className="text-sm text-center max-w-sm mb-6">
                            {language === 'ar' 
                              ? "سيتم إظهار جهات الاتصال المسجلة في التطبيق هنا." 
                              : "Contacts registered in the app will appear here."}
                          </p>
                        </div>
                      )}
                      {contacts.map(contact => {
                        const isSelected = selectedContactIds.includes(contact.id);
                        return (
                        <motion.div 
                    key={contact.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleContactClick(contact)}
                    onTouchStart={() => handlePressStart(contact.id)}
                    onTouchEnd={handlePressEnd}
                    onMouseDown={() => handlePressStart(contact.id)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer group relative",
                      (selectedContact?.id === contact.id || isSelected)
                        ? "bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/5" 
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    {selectionMode && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full border-2 border-slate-600 flex items-center justify-center">
                        {isSelected && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img src={contact.photo_url} alt="" className="w-14 h-14 rounded-full border-2 border-slate-800" />
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold">{contact.display_name}</h4>
                          <p className="text-slate-500 text-xs font-mono">{contact.phone_number}</p>
                        </div>
                      </div>
                      
                      {selectedContact?.id === contact.id && !selectionMode && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); startCallWithContact(contact); }}
                            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
                            title={t.call}
                          >
                            <Video className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveChatUser(contact); }}
                            className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                            title="Voice Message"
                          >
                            <Mic className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveChatUser(contact); }}
                            className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700"
                            title="Text Message"
                          >
                            <MessageSquare className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {appMode === "private-room" && (
            <div className="h-full flex flex-col gap-6 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">{t.privateRoom}</h2>
                  <p className="text-slate-400 text-sm mt-1">Secure, end-to-end encrypted meetings</p>
                </div>
                {joined && (
                  <div className="flex gap-3">
                    <button 
                      onClick={copyInviteLink}
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all border border-slate-700"
                    >
                      <Phone className="w-4 h-4" />
                      {t.inviteToRoom}
                    </button>
                  </div>
                )}
              </div>

              {!joined ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                    <div className="flex flex-col gap-6">
                      <button 
                        onClick={() => joinRoom(undefined, true)}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Plus className="w-5 h-5" />
                        Create New Room
                      </button>
                      
                      <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-800"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">or join existing</span>
                        <div className="flex-grow border-t border-slate-800"></div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <input 
                          type="text" 
                          placeholder="Enter room link or code" 
                          value={roomId}
                          onChange={(e) => setRoomId(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                          onClick={() => joinRoom(roomId, false)}
                          disabled={!roomId}
                          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-white font-bold rounded-xl transition-all border border-slate-700"
                        >
                          <Video className="w-5 h-5" />
                          Join Room
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 grid grid-rows-[1fr,auto] gap-6 min-h-0">
                  {/* Main Display Area */}
                  <div className="relative bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl group">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-full">
                        <ContentComponent 
                          content={screens[activeScreenIndex]} 
                          peers={peers} 
                          userStream={userStream} 
                          userName={userName} 
                          index={activeScreenIndex}
                        />
                      </div>
                    </div>

                    {/* Navigation Arrows */}
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-30">
                      <button 
                        onClick={() => setActiveScreenIndex(prev => (prev < screens.length - 1 ? prev + 1 : 0))}
                        className="p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto opacity-0 group-hover:opacity-100"
                      >
                        <ArrowLeft className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => setActiveScreenIndex(prev => (prev > 0 ? prev - 1 : screens.length - 1))}
                        className="p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto opacity-0 group-hover:opacity-100"
                      >
                        <ArrowRight className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="absolute top-6 left-6 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-white text-xs font-bold flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      {t.mainDisplay}
                    </div>
                  </div>

                  {/* Bottom Area */}
                  <div className="flex flex-col gap-6">
                    {/* Creator Main Screens Control */}
                    {isCreator && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Main Screens Control</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                          {screens.map((screen, idx) => {
                            const isMe = screen.src === "me";
                            const peer = peers.find(p => p.peerId === screen.src);
                            const stream = isMe ? userStream : peer?.stream;
                            const name = isMe ? `${userName} (You)` : peer ? `Guest ${peer.peerId.slice(0, 4)}` : `Screen ${idx + 1}`;
                            const isEmpty = !isMe && !peer && screen.type === "video" && screen.src === "";

                            return (
                              <button 
                                key={idx}
                                onClick={() => setActiveScreenIndex(idx)}
                                className={cn("flex-shrink-0 w-48 h-28 rounded-2xl border-2 transition-all overflow-hidden relative group shadow-lg", activeScreenIndex === idx ? "border-blue-500" : "border-slate-800 hover:border-slate-700", isEmpty && "opacity-50 border-dashed")}
                              >
                                {isEmpty ? (
                                  <div className="w-full h-full bg-slate-900/50 flex flex-col items-center justify-center gap-2">
                                    <Monitor className="w-5 h-5 text-slate-600" />
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Empty Slot</p>
                                  </div>
                                ) : (
                                  <ContentComponent content={screen} peers={peers} userStream={userStream} userName={userName} index={idx} />
                                )}
                                <div className={cn("absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md", badgeColors[idx % badgeColors.length])}>
                                  {idx + 1}
                                </div>
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowPicker(idx);
                                  }}
                                  className="absolute bottom-2 right-2 p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg z-40"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Participants Grid */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{t.participants} ({peers.length + 1})</h3>
                      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar min-h-[120px]">
                        {[{ id: "me", stream: userStream, name: `${userName} (You)` }, ...peers.map(p => ({ id: p.peerId, stream: p.stream, name: `Guest ${p.peerId.slice(0, 4)}` }))].map((participant, idx) => (
                          <div 
                            key={participant.id}
                            className="flex-shrink-0 w-48 h-32 rounded-2xl border border-slate-800 overflow-hidden relative group shadow-lg"
                          >
                            <VideoComponent stream={participant.stream || undefined} muted={participant.id === "me"} name={participant.name} />
                            
                            {isCreator && (
                              <button 
                                onClick={() => {
                                  const newScreens = [...screens];
                                  newScreens[activeScreenIndex] = { type: "video", src: participant.id };
                                  setScreens(newScreens);
                                }}
                                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-40"
                              >
                                <Pin className="w-6 h-6 text-white" />
                                <span className="text-xs font-bold text-white">Pin to Screen {activeScreenIndex + 1}</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {appMode === "broadcast" && (
            <div className="h-full flex flex-col gap-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">{t.broadcast}</h2>
                  <p className="text-slate-400 text-sm mt-1">Go live and reach everyone</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      value={broadcastSearch}
                      onChange={(e) => setBroadcastSearch(e.target.value)}
                      placeholder={t.searchTopic}
                      className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 lg:w-64"
                    />
                  </div>
                  <button 
                    onClick={() => joinRoom()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                  >
                    <Radio className="w-4 h-4" />
                    {t.startBroadcast}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6 flex-1 min-h-0">
                <div className="flex flex-col gap-6">
                  {/* Search Results Overlay */}
                  {broadcastSearch && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Search Results</h4>
                      {filteredBroadcasts.length > 0 ? (
                        filteredBroadcasts.map(b => (
                          <div key={b.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/50 transition-all cursor-pointer">
                            <div>
                              <p className="text-xs font-bold text-white">{b.topic}</p>
                              <p className="text-[10px] text-slate-500">{b.host} • {b.category}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-red-500">{b.viewers}</span>
                              <button onClick={() => { setBroadcastTopic(b.topic); setBroadcastCategory(b.category); setBroadcastSearch(""); }} className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg">Join</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic py-4 text-center">{t.noBroadcasts}</p>
                      )}
                    </div>
                  )}

                  {/* Main Broadcast Screen */}
                  <div className="relative bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl group flex-1">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-full">
                        <ContentComponent 
                          content={screens[activeScreenIndex]} 
                          peers={peers} 
                          userStream={userStream} 
                          userName={userName} 
                          index={activeScreenIndex}
                        />
                      </div>
                    </div>

                    {/* Navigation Arrows */}
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                      <button 
                        onClick={() => setActiveScreenIndex(prev => (prev < screens.length - 1 ? prev + 1 : 0))}
                        className="p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto opacity-0 group-hover:opacity-100"
                      >
                        <ArrowLeft className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => setActiveScreenIndex(prev => (prev > 0 ? prev - 1 : screens.length - 1))}
                        className="p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto opacity-0 group-hover:opacity-100"
                      >
                        <ArrowRight className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="absolute top-6 left-6 flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-red-600/20 animate-pulse">
                        Live
                      </div>
                      <div className="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 text-white text-[10px] font-bold">
                        {broadcastTopic || "Untitled Stream"}
                      </div>
                    </div>
                  </div>

                  {/* Broadcast Setup */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t.category}</label>
                      <select 
                        value={broadcastCategory}
                        onChange={(e) => setBroadcastCategory(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">Select Category</option>
                        <option value="politics">{t.politics}</option>
                        <option value="technology">{t.technology}</option>
                        <option value="sports">{t.sports}</option>
                        <option value="entertainment">{t.entertainment}</option>
                      </select>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t.topic}</label>
                      <input 
                        type="text"
                        value={broadcastTopic}
                        onChange={(e) => setBroadcastTopic(e.target.value)}
                        placeholder="e.g. Cold War History"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Chat / Comments */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                      Live Chat
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-400">1.2k</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex gap-3">
                        <img src={`https://picsum.photos/seed/${i + 10}/100`} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-blue-400 mb-0.5">User_{i}</p>
                          <p className="text-xs text-slate-300 leading-relaxed">This is a great topic! I've always been interested in this.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-800/50 border-t border-slate-800">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Say something..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:text-blue-400">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-slate-950 flex flex-col font-sans overflow-hidden", language === "ar" ? "rtl" : "ltr")}>
      {/* Header */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm leading-none">{roomId}</h2>
            <p className="text-slate-500 text-[10px] mt-1 uppercase tracking-widest font-bold">{t.liveSession}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLanguage}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-2 text-xs font-bold"
          >
            <Languages className="w-4 h-4" />
            {language === "en" ? "AR" : "EN"}
          </button>

          <button 
            onClick={copyInviteLink}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white text-xs font-medium transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            {t.inviteLinkBtn}
          </button>
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                <img src={`https://picsum.photos/seed/${i}/100`} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold">
              +{peers.length}
            </div>
          </div>
          <button className="p-2 text-slate-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          {appMode === "contacts" && (
            <motion.div 
              key="contacts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-end mb-4">
                <div className="flex items-center gap-4">
                  {/* Active Call PIP */}
                  <div className="w-48 aspect-video rounded-xl overflow-hidden border-2 border-blue-500 shadow-lg shadow-blue-500/20">
                    <VideoComponent stream={peers[0]?.stream || userStream || undefined} name="Active Call" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {contacts.map(contact => (
                  <div key={contact.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img src={contact.photo_url} alt="" className="w-12 h-12 rounded-full" />
                      <div>
                        <h4 className="text-white font-bold">{contact.display_name}</h4>
                        <p className="text-slate-500 text-xs">{contact.phone_number}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {appMode === "private-room" && (
            <motion.div 
              key="private"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full gap-6"
            >
              <div className="flex-1 bg-slate-900 rounded-3xl border-2 border-slate-800 overflow-hidden shadow-2xl relative group">
                <div className="w-full h-full">
                  <ContentComponent 
                    content={screens[activeScreenIndex]} 
                    peers={peers} 
                    userStream={userStream} 
                    userName={userName} 
                    index={activeScreenIndex}
                  />
                </div>

                {/* Navigation Arrows */}
                <div dir="ltr" className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-30">
                  <button 
                    onClick={() => setActiveScreenIndex(prev => (prev < screens.length - 1 ? prev + 1 : 0))}
                    className="p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto opacity-0 group-hover:opacity-100"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setActiveScreenIndex(prev => (prev > 0 ? prev - 1 : screens.length - 1))}
                    className="p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto opacity-0 group-hover:opacity-100"
                  >
                    <ArrowRight className="w-6 h-6" />
                  </button>
                </div>

                <div className="absolute top-6 left-6 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-white text-xs font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  {t.mainDisplay} - Slot {activeScreenIndex + 1}
                </div>
              </div>
              
              {/* Connected Participants Below */}
              <div className="h-32 flex flex-col gap-3">
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.participants}</p>
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium italic">{t.switchScreen}</p>
                </div>
                <div className="flex items-center gap-4 overflow-x-auto pb-2 px-2 custom-scrollbar">
                  {screens.map((screen, idx) => {
                    const isMe = screen.src === "me";
                    const peer = peers.find(p => p.peerId === screen.src);
                    const stream = isMe ? userStream : peer?.stream;
                    const name = isMe ? "You" : peer ? `Guest ${peer.peerId.slice(0, 4)}` : `Slot ${idx + 1}`;
                    const isEmpty = !isMe && !peer;

                    return (
                      <button 
                        key={idx}
                        onClick={() => setActiveScreenIndex(idx)}
                        className={cn("flex-shrink-0 w-40 h-24 rounded-2xl border-2 transition-all overflow-hidden relative group shadow-lg", activeScreenIndex === idx ? "border-blue-500" : "border-slate-800 hover:border-slate-700", isEmpty && "opacity-50 border-dashed")}
                      >
                        {isEmpty ? (
                          <div className="w-full h-full bg-slate-900/50 flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                              <Users className="w-4 h-4 text-slate-600" />
                            </div>
                            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">{name}</p>
                          </div>
                        ) : (
                          <VideoComponent stream={stream || undefined} muted={isMe} name={name} />
                        )}
                        <div className={cn("absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md", badgeColors[idx % badgeColors.length])}>
                          {idx + 1}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {appMode === "broadcast" && (
            <motion.div 
              key="broadcast"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex h-full gap-6"
            >
              <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative shadow-2xl">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <div className="px-2 py-1 bg-red-600 rounded text-[10px] font-bold text-white uppercase animate-pulse">Live</div>
                  <div className="px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase">1.2k Viewers</div>
                </div>
                
                <div className="w-full h-full relative group">
                  <ContentComponent 
                    content={screens[activeScreenIndex]} 
                    peers={peers} 
                    userStream={userStream} 
                    userName={userName} 
                    index={activeScreenIndex}
                  />
                  
                  <div dir="ltr" className="absolute inset-y-0 left-0 flex items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                    <button 
                      onClick={() => setActiveScreenIndex((prev) => (prev < screens.length - 1 ? prev + 1 : 0))}
                      className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 border border-white/10"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  </div>
                  <div dir="ltr" className="absolute inset-y-0 right-0 flex items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                    <button 
                      onClick={() => setActiveScreenIndex((prev) => (prev > 0 ? prev - 1 : screens.length - 1))}
                      className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 border border-white/10"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-80 flex flex-col gap-4">
                <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col">
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-500" />
                    Live Chat
                  </h3>
                  <div className="flex-1 space-y-3 overflow-y-auto text-xs custom-scrollbar">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex gap-2">
                        <span className="font-bold text-blue-400">User_{i}:</span>
                        <span className="text-slate-300">This broadcast looks amazing! 🚀</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Say something..." 
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showPicker !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-6">Configure Screen {showPicker + 1}</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { id: "youtube", label: "YouTube", icon: Radio, color: "text-red-500" },
                  { id: "pdf", label: "PDF / Doc", icon: Layout, color: "text-blue-500" },
                  { id: "search", label: "Web Search", icon: Monitor, color: "text-emerald-500" },
                  { id: "image", label: "Image URL", icon: Grid, color: "text-purple-500" },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => {
                      const newScreens = [...screens];
                      newScreens[showPicker] = { type: type.id as ContentType, src: "" };
                      setScreens(newScreens);
                    }}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border transition-all",
                      screens[showPicker].type === type.id ? "bg-blue-600/10 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    )}
                  >
                    <type.icon className={cn("w-5 h-5", type.color)} />
                    <span className="font-medium text-sm">{type.label}</span>
                  </button>
                ))}
              </div>

              {screens[showPicker].type !== "video" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Source URL</label>
                    <input 
                      type="text"
                      value={pickerUrl}
                      onChange={(e) => setPickerUrl(e.target.value)}
                      placeholder="Paste URL here..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        const newScreens = [...screens];
                        newScreens[showPicker].src = pickerUrl;
                        setScreens(newScreens);
                        setShowPicker(null);
                        setPickerUrl("");
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all"
                    >
                      Apply Changes
                    </button>
                    <button 
                      onClick={() => {
                        setShowPicker(null);
                        setPickerUrl("");
                      }}
                      className="px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Bar */}
      <footer className="h-20 px-8 flex items-center justify-between bg-slate-900 border-t border-slate-800 z-10">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-white font-medium text-sm">{userName}</span>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">Host</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMic}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all",
              micOn ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            )}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button 
            onClick={toggleVideo}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all",
              videoOn ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            )}
          >
            {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
          <button className="w-12 h-12 rounded-full bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center transition-all">
            <ScreenShare className="w-5 h-5" />
          </button>
          <div className="w-px h-8 bg-slate-800 mx-2" />
          <button 
            onClick={leaveRoom}
            className="px-6 h-12 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-full flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
          >
            <LogOut className="w-4 h-4" />
            End Call
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
            <Users className="w-4 h-4" />
            <span className="text-xs font-bold">{peers.length + 1}</span>
          </button>
          <button className="p-2 text-slate-400 hover:text-white transition-colors">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
