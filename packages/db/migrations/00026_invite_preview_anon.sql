-- Allow unauthenticated invite link previews (token is the secret).

grant execute on function public.get_workspace_invite_preview(text) to anon;
