
-- ==============================================================================
-- COMPREHENSIVE FIX: DYNAMIC ROLES
-- 
-- The error "policy departments_manage depends on column role" means we must
-- drop policies on the 'departments' table too, not just 'profiles'.
-- ==============================================================================

BEGIN;

-- 1. DROP DEPENDENT POLICIES ON 'DEPARTMENTS'
-- We drop any policy that might check "Is this user an Admin?"
DROP POLICY IF EXISTS "departments_manage" ON public.departments;
DROP POLICY IF EXISTS "Manage Departments" ON public.departments;
DROP POLICY IF EXISTS "View Departments" ON public.departments;

-- 2. DROP POLICIES ON 'PROFILES'
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 3. DROP THE RESTRICTIVE CONSTRAINT
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS users_role_check;

-- 4. ALTER COLUMN TYPE (The core fix)
ALTER TABLE public.profiles ALTER COLUMN role TYPE text;

-- 5. RE-CREATE PROFILES POLICIES

-- Read: Everyone authenticated
CREATE POLICY "profiles_read" ON public.profiles
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Update: Self or Admin
CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('Super Admin', 'Admin')
  )
);

-- Insert: System/Auth
CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT 
WITH CHECK (true);

-- Delete: Admin Only
CREATE POLICY "profiles_delete" ON public.profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('Super Admin', 'Admin')
  )
);

-- 6. RE-CREATE DEPARTMENTS POLICIES

-- Read: Everyone
CREATE POLICY "View Departments" ON public.departments 
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Manage: Admin Only (Re-establishing the logic that caused the lock, but now safe)
CREATE POLICY "Manage Departments" ON public.departments 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')
        )
    );

COMMIT;
