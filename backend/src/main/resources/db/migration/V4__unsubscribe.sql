-- One-click unsubscribe from alert emails. The token only allows pausing alerts, so it is stored as is
-- (it has to appear in every email). Pausing keeps the user's keywords so alerts can be turned back on.
alter table users add column unsubscribe_token varchar(64);
alter table users add column alerts_paused_at timestamptz;
create unique index uq_users_unsubscribe_token on users (unsubscribe_token);
