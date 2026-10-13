-- Notices a signed-in user saved to read later.
create table bookmarks (
    user_id    bigint      not null references users (id) on delete cascade,
    notice_id  bigint      not null references notices (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, notice_id)
);
