
-- ==============================================================================
-- DEPARTMENTS MIGRATION
-- Adds organization structure management
-- ==============================================================================

-- 1. Create Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT, -- e.g. 'UW', 'CLM'
    description TEXT,
    head_of_department UUID REFERENCES auth.users(id), -- Points to a User ID
    max_staff INTEGER DEFAULT 0,
    current_staff_count INTEGER DEFAULT 0, -- Can be maintained via trigger or computed
    parent_department_id UUID REFERENCES public.departments(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Everyone (authenticated) can view departments to populate dropdowns
DROP POLICY IF EXISTS "View Departments" ON public.departments;
CREATE POLICY "View Departments" ON public.departments 
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Only Admins can manage
DROP POLICY IF EXISTS "Manage Departments" ON public.departments;
CREATE POLICY "Manage Departments" ON public.departments 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')
        )
    );

-- 4. Grant Permissions
GRANT ALL ON TABLE public.departments TO postgres, service_role;
GRANT SELECT ON TABLE public.departments TO anon, authenticated;
