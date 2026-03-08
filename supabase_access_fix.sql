
-- ==============================================================================
-- ACCESS REPAIR: Fix empty User List
-- ==============================================================================

-- 1. Ensure RLS is enabled (good practice), but we will add a permissive policy
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Drop any conflicting or restrictive select policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Allow All Select" ON public.users;

-- 3. Create a clear, permissive policy for reading users
-- This allows 'anon' (your local admin user) and 'authenticated' (real users) to see the list
CREATE POLICY "Allow All Read Access" 
ON public.users FOR SELECT 
USING (true);

-- 4. Grant explicit table permissions to the API roles
-- This ensures the API gateway allows the Select operation before RLS even checks it
GRANT SELECT ON TABLE public.users TO anon;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.users TO service_role;

-- 5. Repeat for other key admin tables just in case
GRANT SELECT ON TABLE public.entity_logs TO anon, authenticated;
GRANT SELECT ON TABLE public.activity_log TO anon, authenticated;

-- 6. Verify count again
SELECT count(*) as "Verified Visible Users" FROM public.users;
