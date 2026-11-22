'use client';

import { DEMO } from '../config';
import { createDemoBackend } from './demo';
import { createSupabaseBackend } from './supabase';
import type { Backend } from './types';

let instance: Backend | null = null;

export function getBackend(): Backend {
  if (!instance) instance = DEMO ? createDemoBackend() : createSupabaseBackend();
  return instance;
}

export type { Backend } from './types';
