-- English title/summary per notice, and the work queue that produces them.
-- One row per notice. A row is (re)queued whenever the notice's content hash changes.
create table notice_summaries (
    notice_id       bigint       primary key references notices (id) on delete cascade,
    -- the notice version this row is about; a finished summary is only saved if it still matches
    content_hash    varchar(64)  not null,
    status          varchar(20)  not null,   -- PENDING, RUNNING, DONE, FAILED
    title_en        text,
    summary_en      text,
    deadline        date,
    deadline_note   text,
    model           varchar(100),
    attempts        int          not null default 0,
    last_error      text,
    next_attempt_at timestamptz  not null default now(),
    -- a RUNNING row whose lock expired (worker crashed) is picked up again
    locked_until    timestamptz,
    updated_at      timestamptz  not null default now()
);

create index idx_summaries_queue on notice_summaries (next_attempt_at) where status in ('PENDING', 'RUNNING');

-- queue every notice stored before this migration
insert into notice_summaries (notice_id, content_hash, status)
select id, content_hash, 'PENDING' from notices;
