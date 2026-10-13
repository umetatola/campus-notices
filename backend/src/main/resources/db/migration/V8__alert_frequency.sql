-- Alert emails either go out as soon as notices match (INSTANT) or once a day at 08:00 Korean time (DAILY).
-- last_digest_at: when the user's last alert email was sent; a daily user gets the next one after the next 08:00.
alter table users add column alert_frequency varchar(10) not null default 'INSTANT'
    check (alert_frequency in ('INSTANT', 'DAILY'));
alter table users add column last_digest_at timestamptz;
