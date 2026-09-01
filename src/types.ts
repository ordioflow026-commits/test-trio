export type AppState = 'registration' | 'home' | 'scanner' | 'room';

export interface UserProfile {
  id: string;
  nickname: string;
  language: string;
  isSpeaking?: boolean;
}

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'zh', name: 'Mandarin' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];
