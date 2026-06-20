-- Run in Supabase → SQL Editor.
--
-- Adds a "registration_closed" status admins can set on a tournament: it
-- automatically blocks new sign-ups (the backend already rejects
-- registration unless status = 'registration_open') and players see a
-- "Registration is closed" message instead of the Register button.
--
-- Status flow becomes: upcoming -> registration_open -> registration_closed
-- -> in_progress -> completed (or cancelled at any point).

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'tournaments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if con_name is not null then
    execute format('alter table tournaments drop constraint %I', con_name);
  end if;
end $$;

alter table tournaments
  add constraint tournaments_status_check
  check (status in (
    'upcoming', 'registration_open', 'registration_closed',
    'in_progress', 'completed', 'cancelled'
  ));
