-- Auto-reply on/off, controlled from Settings → Auto-reply. Default OFF so the
-- agent never emails recruiters on Krishna's behalf unless he turns it on.
alter table admin_settings
  add column if not exists auto_reply_enabled boolean not null default false;
