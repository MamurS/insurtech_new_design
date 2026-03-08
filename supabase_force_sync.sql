
-- ==============================================================================
-- FORCE SYNC: Auth -> Public
-- Run this script to fix missing users in the Admin Console
-- ==============================================================================

-- 1. Ensure RLS policies are not hiding data
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.users FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
CREATE POLICY "Admins can update all profiles" 
ON public.users FOR UPDATE 
USING (
  -- Allow users to update themselves OR Admins to update anyone
  auth.uid() = id 
  OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin'))
);

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.users;
CREATE POLICY "Admins can insert profiles" 
ON public.users FOR INSERT 
WITH CHECK (true); -- Allow system/triggers to insert

-- 2. FORCE BACKFILL
-- Upsert all users from auth.users into public.users
INSERT INTO public.users (id, email, name, role, "avatarUrl", "isActive", created_at)
SELECT 
    au.id, 
    au.email, 
    -- Prefer metadata name, fallback to email
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)), 
    -- Default role (Only used if creating new record)
    COALESCE(au.raw_user_meta_data->>'role', 'Viewer'),
    -- Avatar
    COALESCE(au.raw_user_meta_data->>'avatar_url', 'NU'),
    TRUE, -- Ensure they are active
    au.created_at
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    -- Only update name if it is currently null in public table
    name = COALESCE(public.users.name, EXCLUDED.name),
    -- Ensure isActive is set
    "isActive" = COALESCE(public.users."isActive", TRUE),
    -- Ensure avatar is set
    "avatarUrl" = COALESCE(public.users."avatarUrl", EXCLUDED."avatarUrl");

-- 3. CONFIRMATION
SELECT count(*) as "Total Users in Auth" FROM auth.users;
SELECT count(*) as "Total Users in Public" FROM public.users;
