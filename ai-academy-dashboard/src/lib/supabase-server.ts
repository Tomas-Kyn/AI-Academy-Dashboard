import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(
      `Missing env: ${name}. Set it in Vercel → Project → Settings → Environment Variables.`
    );
  }
  return value;
}

// Server client for server components and API routes
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
