-- When the crawler last finished, per source, so the site can say how fresh its notices are.
create table crawl_status (
    source          varchar(50) primary key,
    last_success_at timestamptz,
    last_attempt_at timestamptz not null,
    last_error      text
);
