
-- ==============================================================================
-- AGENDA & USERS MIGRATION
-- Adds support for Task Management, Activity Logging, and Enhanced User Profiles
-- ==============================================================================

-- 1. ENHANCE USERS TABLE
-- Add columns for extended profile info if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'department') THEN
        ALTER TABLE public.users ADD COLUMN department text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE public.users ADD COLUMN phone text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isActive') THEN
        ALTER TABLE public.users ADD COLUMN "isActive" boolean DEFAULT true;
    END IF;
END $$;

-- 2. AGENDA TASKS TABLE
CREATE TABLE IF NOT EXISTS public.agenda_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    status TEXT DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    due_date TIMESTAMP WITH TIME ZONE,
    
    assigned_to UUID REFERENCES auth.users(id), -- Assignee
    assigned_by UUID REFERENCES auth.users(id), -- Assigner
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Linkage to System Entities
    entity_type TEXT, -- POLICY, SLIP, CLAIM, etc.
    entity_id TEXT, -- UUID of the linked record
    
    -- Denormalized for display speed (optional but helpful)
    policy_number TEXT,
    insured_name TEXT,
    broker_name TEXT,
    
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.agenda_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view assigned tasks or created tasks" ON public.agenda_tasks
    FOR SELECT USING (auth.uid() = assigned_to OR auth.uid() = assigned_by OR auth.uid() = created_by);
    
CREATE POLICY "Users can insert tasks" ON public.agenda_tasks
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update assigned tasks" ON public.agenda_tasks
    FOR UPDATE USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);

-- 3. ACTIVITY LOG TABLE
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    
    action TEXT, -- e.g., 'CREATED_POLICY', 'UPDATED_CLAIM'
    action_description TEXT,
    
    entity_type TEXT,
    entity_id TEXT,
    entity_reference TEXT, -- e.g., Policy Number
    
    old_values JSONB,
    new_values JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View activity logs" ON public.activity_log
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert activity logs" ON public.activity_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. RPC: GET AGENDA TASKS (With joins/names)
CREATE OR REPLACE FUNCTION get_agenda_tasks(p_user_id UUID DEFAULT NULL, p_status TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    priority TEXT,
    status TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    assigned_to UUID,
    assigned_to_name TEXT,
    assigned_by_name TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    entity_type TEXT,
    entity_id TEXT,
    policy_number TEXT,
    insured_name TEXT,
    broker_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    is_overdue BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.due_date,
        t.assigned_to,
        u_to.name as assigned_to_name,
        u_by.name as assigned_by_name,
        t.assigned_at,
        t.entity_type,
        t.entity_id,
        t.policy_number,
        t.insured_name,
        t.broker_name,
        t.created_at,
        CASE 
            WHEN t.status != 'COMPLETED' AND t.due_date < NOW() THEN TRUE 
            ELSE FALSE 
        END as is_overdue
    FROM 
        public.agenda_tasks t
    LEFT JOIN 
        public.users u_to ON t.assigned_to = u_to.id
    LEFT JOIN 
        public.users u_by ON t.assigned_by = u_by.id
    WHERE 
        (p_user_id IS NULL OR t.assigned_to = p_user_id)
        AND
        (p_status IS NULL OR t.status = p_status)
    ORDER BY 
        -- Urgent/High first, then by Due Date
        CASE t.priority 
            WHEN 'URGENT' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            ELSE 4 
        END ASC,
        t.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
