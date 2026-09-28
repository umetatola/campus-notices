create table notices (
    id                bigserial primary key,
    source            varchar(50)  not null,
    source_article_id varchar(50)  not null,
    category          varchar(100),
    title             text         not null,
    department        varchar(200),
    posted_on         date         not null,
    url               text         not null,
    pinned            boolean      not null default false,
    body_html         text,
    body_text         text,
    -- sha-256 of title + body text; a change means the notice was edited
    content_hash      char(64)     not null,
    first_seen_at     timestamptz  not null default now(),
    updated_at        timestamptz  not null default now(),
    constraint uq_notice_source_article unique (source, source_article_id)
);

create index idx_notices_posted_on on notices (posted_on desc, id desc);
create index idx_notices_category on notices (category);

create table notice_attachments (
    notice_id bigint not null references notices (id) on delete cascade,
    position  int    not null,
    name      text   not null,
    url       text   not null,
    primary key (notice_id, position)
);
