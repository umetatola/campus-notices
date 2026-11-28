-- Notices a signed-in user has opened, so unread ones show in bold on every device they sign in on.
create table notice_reads (
    user_id    bigint      not null references users (id) on delete cascade,
    notice_id  bigint      not null references notices (id) on delete cascade,
    read_at    timestamptz not null default now(),
    primary key (user_id, notice_id)
);

-- the list comes back newest first and old rows are trimmed per user
create index notice_reads_user_read_at on notice_reads (user_id, read_at desc);
