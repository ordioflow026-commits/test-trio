import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations = {
  en: {
    login: 'START',
    fullName: 'Full Name',
    phoneNumber: 'Phone Number',
    personalInfo: 'Personal Info',
    notifications: 'Notifications',
    homeHub: 'Home Hub',
    broadcast: 'Broadcast',
    privateRoom: 'Private Room',
    contacts: 'Contacts',
    loading: 'Loading...',
    welcome: 'Welcome',
    enterName: 'Enter your full name',
    enterPhone: 'Enter your phone number',
    call: 'Call',
    message: 'Message',
    audioCall: 'Audio Call',
    videoCall: 'Video Call',
    textMessage: 'Text Message',
    voiceMessage: 'Voice Message',
    groupVideoCall: 'Group Video Call',
    selected: 'Selected',
    back: 'Back',
    createPrivateRoom: 'Create Private Room',
    joinPrivateRoom: 'Join Private Room',
    groupName: 'Group Name',
    privateNumber: 'Private Number (PIN)',
    create: 'Create',
    roomLink: 'Room Link',
    copyLink: 'Copy Link',
    enterRoomLink: 'Enter Room Link',
    join: 'Join',
    cancel: 'Cancel',
    linkCopied: 'Link Copied!',
    webPage: 'Web Page',
    youtubeVideo: 'YouTube Video',
    whiteboard: 'Whiteboard',
    mediaGallery: 'Media Gallery',
    addContent: 'Add Content',
    enterRoom: 'Enter Room',
    exitRoom: 'Exit Room',
    recentRooms: 'Recent Rooms',
    myRooms: 'My Rooms',
    visitor: 'Visitor',
    noRooms: 'No rooms found',
    broadcastSetup: 'Broadcast Setup',
    streamField: 'Field',
    streamTopic: 'Topic',
    interactionMode: 'Interaction Mode',
    publicChat: 'Public Chat',
    requestToJoin: 'Request to Join',
    audioOnly: 'Audio Only',
    searchability: 'Searchability',
    isPublic: 'Public',
    isPrivate: 'Private',
    goLive: 'Go Live',
    live: 'LIVE',
    sendGift: 'Send Gift',
    typeComment: 'Type a comment...',
    education: 'Education',
    tech: 'Tech',
    gaming: 'Gaming',
    social: 'Social',
    mainStream: 'Main Stream',
    collaboration: 'Collaboration',
    mediaTools: 'Media / Tools',
    joinRequests: 'Join Requests',
    startBroadcast: 'Start Broadcast',
    searchTopic: 'Search by topic...',
    activeBroadcasts: 'Active Broadcasts',
    watch: 'Watch',
    liveCamera: 'Live Camera',
    uploadFile: 'Upload File',
    enterUrl: 'Enter Link (PDF, Image, Web)',
    invalidUrl: 'Invalid URL',
    noVideoSelected: 'No video selected',
    receivingBroadcast: 'Receiving Live Broadcast...',
    hostCamera: 'Host Camera',
    waitingForHost: 'Waiting for host...',
    fileViewer: 'File Viewer',
    freeView: 'Free View',
    syncView: 'Sync View',
    room: 'Room',
    online: 'Online',
    waitingForSomeone: 'Waiting for someone to join...',
    onlyVisitor: 'You are the only visitor.',
    you: 'YOU',
  },
  ar: {
    login: 'ابدأ',
    fullName: 'الاسم الكامل',
    phoneNumber: 'رقم الهاتف',
    personalInfo: 'المعلومات الشخصية',
    notifications: 'الإشعارات',
    homeHub: 'الرئيسية',
    broadcast: 'بث',
    privateRoom: 'غرفة خاصة',
    contacts: 'جهات الاتصال',
    loading: 'جاري التحميل...',
    welcome: 'مرحباً',
    enterName: 'أدخل اسمك الكامل',
    enterPhone: 'أدخل رقم هاتفك',
    call: 'اتصال',
    message: 'رسالة',
    audioCall: 'مكالمة صوتية',
    videoCall: 'مكالمة فيديو',
    textMessage: 'رسالة نصية',
    voiceMessage: 'رسالة صوتية',
    groupVideoCall: 'مكالمة فيديو جماعية',
    selected: 'محدد',
    back: 'رجوع',
    createPrivateRoom: 'إنشاء غرفة خاصة',
    joinPrivateRoom: 'انضم للغرفة الخاصة',
    groupName: 'اسم المجموعة',
    privateNumber: 'رقم خاص (PIN)',
    create: 'إنشاء',
    roomLink: 'رابط الغرفة',
    copyLink: 'نسخ الرابط',
    enterRoomLink: 'أدخل رابط الغرفة',
    join: 'انضمام',
    cancel: 'إلغاء',
    linkCopied: 'تم نسخ الرابط!',
    webPage: 'صفحة ويب',
    youtubeVideo: 'فيديو يوتيوب',
    whiteboard: 'سبورة بيضاء',
    mediaGallery: 'معرض الوسائط',
    addContent: 'إضافة محتوى',
    enterRoom: 'دخول الغرفة',
    exitRoom: 'الخروج من الغرفة',
    recentRooms: 'الغرف الأخيرة',
    myRooms: 'غرفي',
    visitor: 'زائر',
    noRooms: 'لا توجد غرف',
    broadcastSetup: 'إعداد البث',
    streamField: 'المجال',
    streamTopic: 'الموضوع',
    interactionMode: 'وضع التفاعل',
    publicChat: 'دردشة عامة',
    requestToJoin: 'طلب انضمام',
    audioOnly: 'صوت فقط',
    searchability: 'إمكانية البحث',
    isPublic: 'عام',
    isPrivate: 'خاص',
    goLive: 'ابدأ البث',
    live: 'مباشر',
    sendGift: 'إرسال هدية',
    typeComment: 'اكتب تعليقاً...',
    education: 'تعليم',
    tech: 'تقنية',
    gaming: 'ألعاب',
    social: 'اجتماعي',
    mainStream: 'البث الرئيسي',
    collaboration: 'التعاون',
    mediaTools: 'الوسائط / الأدوات',
    joinRequests: 'طلبات الانضمام',
    startBroadcast: 'بدء البث',
    searchTopic: 'البحث عن موضوع...',
    activeBroadcasts: 'البثوث المباشرة الحالية',
    watch: 'شاهد',
    liveCamera: 'كاميرا مباشرة',
    uploadFile: 'رفع ملف',
    enterUrl: 'أدخل رابط (PDF, صورة, موقع)',
    invalidUrl: 'رابط غير صالح',
    noVideoSelected: 'لم يتم تحديد فيديو',
    receivingBroadcast: 'استقبال بث مباشر...',
    hostCamera: 'كاميرا المضيف',
    waitingForHost: 'في انتظار المضيف...',
    fileViewer: 'عارض الملفات',
    freeView: 'عرض حر',
    syncView: 'عرض متزامن',
    room: 'الغرفة',
    online: 'متصل',
    waitingForSomeone: 'في انتظار انضمام شخص ما...',
    onlyVisitor: 'أنت الزائر الوحيد.',
    you: 'أنت',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
