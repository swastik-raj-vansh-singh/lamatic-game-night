export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Without Supabase keys the app runs fully in the browser so you can try it. */
export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const EMAIL_DOMAIN = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || 'lamatic.ai').trim().toLowerCase();
export const EVENT_DATE_LABEL = process.env.NEXT_PUBLIC_EVENT_DATE_LABEL || 'Tuesday · 24 November';

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith('@' + EMAIL_DOMAIN);
}

export const AVATARS = ['🎤', '🎸', '🥁', '🎧', '🎺', '🎹', '🦄', '🐯', '🐼', '🦊', '🐙', '🚀', '🍕', '🌶️', '👑', '🔥'];
