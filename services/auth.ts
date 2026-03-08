
import { supabase } from './supabase';
import { User, UserRole, DEFAULT_PERMISSIONS, UserPermissions } from '../types';
import { DB, SEED_USERS } from './db';

const USER_STORAGE_KEY = 'insurtech_user_session';

// Helper to check if we should use Supabase
const isSupabaseEnabled = () => {
    return !!supabase;
};

export const AuthService = {
  /**
   * Attempts to get the current session.
   * Checks Supabase first, merging Auth state with Public Profile data.
   */
  getSession: async (): Promise<User | null> => {
    // 1. Check Supabase Real Auth (Only if enabled)
    if (isSupabaseEnabled()) {
      const { data: { session } } = await supabase!.auth.getSession();
      if (session?.user) {

        // Fetch Profile from 'profiles' table
        const { data: profile } = await supabase!
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // Block deactivated users from restoring session
        if (profile && profile.is_active === false) {
          await supabase!.auth.signOut();
          return null;
        }

        // Default Role if no profile found (e.g. first login)
        const role: UserRole = profile?.role || 'Underwriter';
        // Profile might not have permissions column directly anymore if using RBAC, 
        // but keeping fallback for compatibility.
        const permissions: UserPermissions = (profile as any)?.permissions || DEFAULT_PERMISSIONS[role];

        return {
          id: session.user.id,
          email: session.user.email || '',
          name: profile?.full_name || profile?.name || session.user.user_metadata.full_name || 'User',
          role: role, 
          avatarUrl: profile?.avatar_url || profile?.avatarUrl || session.user.user_metadata.avatar_url || 'U',
          lastLogin: session.user.last_sign_in_at,
          permissions: permissions,
          roleId: profile?.role_id
        };
      }
    }

    // 2. Fallback to Local Mock Storage
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    return null;
  },

  /**
   * Performs authentication.
   * In production: Supabase only
   * In development: Allows env-configured dev users (if explicitly enabled)
   */
  login: async (email: string, password?: string): Promise<User | null> => {
    // Development backdoor - ONLY if explicitly enabled via env var
    if (import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true' && import.meta.env.DEV) {
      const seedUser = SEED_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (seedUser && seedUser.password === password) {
        const safeUser = {
          ...seedUser,
          lastLogin: new Date().toISOString(),
          permissions: seedUser.permissions || DEFAULT_PERMISSIONS[seedUser.role]
        };
        const { password: _, ...sessionUser } = safeUser;
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(sessionUser));
        return sessionUser as User;
      }
    }

    // Production authentication - Supabase ONLY
    if (!isSupabaseEnabled()) {
      throw new Error("Database connection required for authentication.");
    }

    if (!email.includes('@')) {
      throw new Error("Please enter a valid email address.");
    }

    const { data, error } = await supabase!.auth.signInWithPassword({
      email,
      password: password || ''
    });

    if (error) {
      // Don't expose internal error details
      if (error.message.includes('Invalid login')) {
        throw new Error('Invalid email or password');
      }
      throw new Error('Authentication failed. Please try again.');
    }

    if (!data.session) {
      throw new Error('Authentication failed. Please try again.');
    }

    // Fetch Profile from 'profiles'
    const { data: profile } = await supabase!
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Check if the user account has been deactivated
    if (profile && profile.is_active === false) {
      await supabase!.auth.signOut();
      throw new Error('Your account has been deactivated. Contact your administrator.');
    }

    const role: UserRole = profile?.role || 'Underwriter';
    const permissions: UserPermissions = (profile as any)?.permissions || DEFAULT_PERMISSIONS[role];

    return {
      id: data.user.id,
      email: data.user.email || '',
      name: profile?.full_name || profile?.name || data.user.user_metadata.full_name || 'User',
      role: role,
      avatarUrl: profile?.avatar_url || profile?.avatarUrl || data.user.user_metadata.avatar_url || 'U',
      lastLogin: new Date().toISOString(),
      permissions: permissions,
      roleId: profile?.role_id
    };
  },

  /**
   * Registers a new user (Supabase Only)
   */
  register: async (
    email: string, 
    password?: string, 
    name?: string, 
    role?: UserRole, 
    permissions?: UserPermissions
  ): Promise<User | null> => {
    if (!isSupabaseEnabled()) {
      throw new Error("Registration is only available when connected to a database.");
    }

    // 1. Create Auth User
    const { data, error } = await supabase!.auth.signUp({
      email,
      password: password || '',
      options: {
        data: {
          full_name: name,
          avatar_url: name ? name.substring(0, 2).toUpperCase() : 'NU'
        }
      }
    });

    if (error) throw error;
    if (!data.user) return null;

    const finalRole = role || 'Super Admin';
    const finalPermissions = permissions || DEFAULT_PERMISSIONS[finalRole];

    // 3. Create/Update Profile in 'profiles'
    const newUserProfile = {
      id: data.user.id,
      email: email,
      full_name: name || 'New User',
      role: finalRole,
      avatar_url: name ? name.substring(0, 2).toUpperCase() : 'NU',
      // permissions: finalPermissions, // Optional depending on schema, keeping logic clean
      // lastLogin is not usually in profiles, but kept if schema matches
    };

    const { error: profileError } = await supabase!
      .from('profiles')
      .upsert(newUserProfile);

    if (profileError) {
      console.error("Profile creation/update failed", profileError);
    }

    return {
        id: data.user.id,
        email: email,
        name: name || 'New User',
        role: finalRole,
        avatarUrl: newUserProfile.avatar_url,
        permissions: finalPermissions,
        lastLogin: new Date().toISOString()
    };
  },

  logout: async (): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.auth.signOut();
    }
    localStorage.removeItem(USER_STORAGE_KEY);
  },

  getUsers: async () => {
      return await DB.getUsers();
  }
};
