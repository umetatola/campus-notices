-- Recent notices are re-fetched now and then to catch edits. checked_at: last time the crawler looked;
-- edited_at: when the content last changed after the notice was first stored (null = never edited).
alter table notices add column checked_at timestamptz;
alter table notices add column edited_at timestamptz;
update notices set checked_at = updated_at;
