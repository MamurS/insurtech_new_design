
-- ==============================================================================
-- DELETE USER RPC
-- Run this script to enable full user deletion (Auth + Profile) from the Admin Console
-- ==============================================================================

-- Create a secure function to delete a user from auth.users
-- This cascades to public.profiles if foreign keys are set up correctly, 
-- or you can add explicit deletes here.
CREATE OR REPLACE FUNCTION delete_user_account(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the privileges of the creator (postgres/admin)
AS $$
BEGIN
  -- 1. Security Check: Only Allow Admins/Super Admins to execute this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('Super Admin', 'Admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only Admins can delete users.';
  END IF;

  -- 2. Prevent self-deletion (Optional but recommended)
  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operation Failed: You cannot delete your own account.';
  END IF;

  -- 3. Delete from auth.users
  -- This typically cascades to public.profiles due to FK constraints.
  -- If not, uncomment the next line:
  -- DELETE FROM public.profiles WHERE id = user_id;
  
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;
