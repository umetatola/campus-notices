-- Accounts are just verified email addresses: users sign in with a one-time link, so there are no passwords.
create table users (
    id            bigserial    primary key,
    email         varchar(320) not null,
    created_at    timestamptz  not null default now(),
    last_login_at timestamptz
);
create unique index uq_users_email on users (lower(email));

-- Sign-in links. Only a SHA-256 hash of the token is stored, so a database leak can't be used to sign in.
create table login_tokens (
    id         bigserial    primary key,
    email      varchar(320) not null,
    token_hash varchar(64)  not null unique,
    expires_at timestamptz  not null,
    used_at    timestamptz,
    created_at timestamptz  not null default now()
);
create index idx_login_tokens_email on login_tokens (lower(email), created_at desc);

create table subscriptions (
    id         bigserial    primary key,
    user_id    bigint       not null references users (id) on delete cascade,
    keyword    varchar(50)  not null,
    created_at timestamptz  not null default now()
);
create unique index uq_subscriptions_user_keyword on subscriptions (user_id, lower(keyword));

-- One row per (user, notice) the user should hear about; the primary key makes duplicate alerts impossible.
-- Rows with sent_at null are the email outbox.
create table alert_deliveries (
    user_id    bigint       not null references users (id) on delete cascade,
    notice_id  bigint       not null references notices (id) on delete cascade,
    keyword    varchar(50)  not null,
    created_at timestamptz  not null default now(),
    sent_at    timestamptz,
    attempts   int          not null default 0,
    last_error text,
    primary key (user_id, notice_id)
);
create index idx_alert_outbox on alert_deliveries (user_id) where sent_at is null;

-- When a notice was checked against subscriptions. Notices stored before this migration count as checked,
-- so nobody is alerted about old news.
alter table notices add column alerts_checked_at timestamptz;
update notices set alerts_checked_at = now();
create index idx_notices_alerts_pending on notices (first_seen_at) where alerts_checked_at is null;
