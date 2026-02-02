'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import type { Participant, UserStatus } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  participant: Participant | null;
  isLoading: boolean;
  isAdmin: boolean;
  isActualAdmin: boolean;
  viewAsUser: boolean;
  setViewAsUser: (value: boolean) => void;
  userStatus: UserStatus | 'no_profile' | null;
  signOut: () => Promise<void>;
  refreshParticipant: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  participant: null,
  isLoading: true,
  isAdmin: false,
  isActualAdmin: false,
  viewAsUser: false,
  setViewAsUser: () => {},
  userStatus: null,
  signOut: async () => {},
  refreshParticipant: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signInWithMagicLink: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActualAdmin, setIsActualAdmin] = useState(false);
  const [viewAsUser, setViewAsUser] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus | 'no_profile' | null>(null);

  const authInitialized = useRef(false);
  const isAdmin = isActualAdmin && !viewAsUser;
  const supabase = getSupabaseClient();

  // Fetch participant with error handling
  const fetchParticipant = async (authUser: User): Promise<Participant | null> => {
    try {
      // Try to find by email first
      if (authUser.email) {
        const { data } = await supabase
          .from('participants')
          .select('*')
          .eq('email', authUser.email)
          .single();
        if (data) return data as Participant;
      }

      // Try by github_username
      if (authUser.user_metadata?.user_name) {
        const { data } = await supabase
          .from('participants')
          .select('*')
          .eq('github_username', authUser.user_metadata.user_name)
          .single();
        if (data) return data as Participant;
      }

      // Try by auth_user_id
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single();
      if (data) return data as Participant;

      return null;
    } catch (error) {
      console.error('fetchParticipant error:', error);
      return null;
    }
  };

  // Check admin status
  const checkAdminUser = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
      return !!data;
    } catch {
      return false;
    }
  };

  const refreshParticipant = async () => {
    if (user) {
      const participantData = await fetchParticipant(user);
      if (participantData) {
        setParticipant(participantData);
        setUserStatus('approved');
        setIsActualAdmin(participantData.is_admin || false);
      }
    }
  };

  useEffect(() => {
    if (authInitialized.current) return;
    authInitialized.current = true;

    // Safety timeout - always set isLoading to false after 10 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('Auth initialization timed out');
      setIsLoading(false);
    }, 10000);

    const initAuth = async () => {
      try {
        // Get session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!initialSession) {
          setIsLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }

        // Validate session
        const { data: { user: validatedUser }, error } = await supabase.auth.getUser();

        if (error || !validatedUser) {
          console.log('Session validation failed:', error?.message);
          setIsLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }

        setSession(initialSession);
        setUser(validatedUser);

        // Fetch participant
        const participantData = await fetchParticipant(validatedUser);

        if (participantData) {
          setParticipant(participantData);
          setUserStatus('approved');
          setIsActualAdmin(participantData.is_admin || false);

          // Link auth_user_id if needed
          if (!participantData.auth_user_id) {
            supabase
              .from('participants')
              .update({ auth_user_id: validatedUser.id })
              .eq('id', participantData.id)
              .then(() => {});
          }
        } else {
          setUserStatus('no_profile');
        }

        // Check admin_users table
        const isAdminUser = await checkAdminUser(validatedUser.id);
        if (isAdminUser) {
          setIsActualAdmin(true);
          setUserStatus('approved');
        }

      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
        clearTimeout(safetyTimeout);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setParticipant(null);
          setIsActualAdmin(false);
          setUserStatus(null);
          return;
        }

        if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);

          try {
            const participantData = await fetchParticipant(newSession.user);
            if (participantData) {
              setParticipant(participantData);
              setUserStatus('approved');
              setIsActualAdmin(participantData.is_admin || false);
            } else {
              setUserStatus('no_profile');
            }

            const isAdminUser = await checkAdminUser(newSession.user.id);
            if (isAdminUser) {
              setIsActualAdmin(true);
              setUserStatus('approved');
            }
          } catch (error) {
            console.error('Auth state change error:', error);
          }
        }
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setParticipant(null);
    setIsActualAdmin(false);
    setUserStatus(null);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        participant,
        isLoading,
        isAdmin,
        isActualAdmin,
        viewAsUser,
        setViewAsUser,
        userStatus,
        signOut,
        refreshParticipant,
        signInWithEmail,
        signInWithMagicLink,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
