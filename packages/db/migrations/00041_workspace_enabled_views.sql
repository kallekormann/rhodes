-- Additional scope views selected at creation (catalog wired in a later phase).

alter table workspaces
  add column if not exists enabled_views text[] not null default '{}';
