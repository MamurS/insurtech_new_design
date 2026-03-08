-- Migration: Add deactivated_at column + delete_auth_user RPC
-- The is_active column already exists; this adds the deactivated_at timestamp.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- RPC to delete an auth.users entry (frees the email for re-registration).
-- Must be SECURITY DEFINER since clients can't access auth schema directly.
CREATE OR REPLACE FUNCTION public.delete_auth_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
