
-- ==============================================================================
-- USER SYNC FIX: Auth -> Public
-- ==============================================================================

-- 1. Create a function to handle new user signups automatically
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, "avatarUrl", created_at, "isActive")
  VALUES (
    NEW.id, 
    NEW.email, 
    -- Try to get name from metadata, fallback to email username
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 
    -- Default role
    'Viewer', 
    -- Avatar
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    "lastLogin" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. BACKFILL: Copy existing users from auth.users to public.users immediately
INSERT INTO public.users (id, email, name, role, "avatarUrl", created_at, "isActive")
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  'Viewer', -- Default role for backfilled users (Change this to 'Admin' manually if needed)
  raw_user_meta_data->>'avatar_url',
  created_at,
  TRUE
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Verify RLS (Ensure data is readable)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.users FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
CREATE POLICY "Admins can update all profiles" 
ON public.users FOR UPDATE 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('Super Admin', 'Admin')
  OR auth.uid() = id
);
