REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (display_name, phone, updated_at) ON TABLE public.profiles TO authenticated;