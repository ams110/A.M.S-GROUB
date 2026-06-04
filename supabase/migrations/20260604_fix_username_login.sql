-- Bug found during browser QA: username login was fully broken.
-- The login form calls supabase.rpc("get_email_by_username"), which hits the
-- PUBLIC schema (PostgREST default), but the function only existed in `store`,
-- returning HTTP 404 ("שם משתמש או אימייל לא נמצאו"). Every other store RPC
-- already has a public wrapper; this one was missed when username login shipped.
create or replace function public.get_email_by_username(uname text)
  returns text
  language sql
  stable
  security definer
  set search_path to 'store', 'public'
as $$ select store.get_email_by_username(uname); $$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;
