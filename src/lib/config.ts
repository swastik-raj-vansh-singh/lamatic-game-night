export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Without Supabase keys the app runs fully in the browser so you can try it. */
export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const EVENT_DATE_LABEL = 'Tuesday · 24 November';

/** Anyone can sign in: this only checks that it looks like an email address. */
export function isValidEmail(email: string | null | undefined): boolean {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const AVATARS = ['🎤', '🎸', '🥁', '🎧', '🎺', '🎹', '🦄', '🐯', '🐼', '🦊', '🐙', '🚀', '🍕', '🌶️', '👑', '🔥'];
