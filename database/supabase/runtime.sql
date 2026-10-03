-- Apply after schema.sql. Single active bot writer; dashboard shares that process.
begin;
create table if not exists public.bot_runtime (
 id boolean primary key default true check(id), owner uuid, expires_at timestamptz,
 revision bigint not null default 0, last_operation uuid, last_digest text
);
insert into public.bot_runtime(id) values(true) on conflict do nothing;
alter table public.bot_runtime enable row level security;
revoke all on public.bot_runtime from public, anon, authenticated;
grant select, insert, update on public.bot_runtime to service_role;
create or replace function public.runtime_lease(instance uuid, release boolean default false) returns bigint
language plpgsql security invoker set search_path='' as $$
declare current_row public.bot_runtime%rowtype;
begin
 select * into current_row from public.bot_runtime where id=true for update;
 if current_row.owner is not null and current_row.owner <> instance and current_row.expires_at > now() then
   raise exception 'Another bot instance owns the runtime lease';
 end if;
 update public.bot_runtime set owner=case when release then null else instance end,
 expires_at=case when release then null else now()+interval '90 seconds' end where id=true;
 return current_row.revision;
end; $$;
create or replace function public.runtime_load(instance uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb := '{}'::jsonb; table_name text; rows jsonb; original jsonb;
begin
 perform public.runtime_lease(instance);
 select i.original into original from public.legacy_imports i order by created_at desc limit 1;
 if original is null then raise exception 'Run the legacy migration before starting Supabase runtime'; end if;
 foreach table_name in array array['guilds','users','guild_settings','user_profiles','user_economy','user_inventory','user_animals','user_pets','user_weapons','user_music_favorites','user_quests','user_statistics','user_achievements','user_marriages','user_music_playlists','moderation_cases','guild_music_panels','guild_music_history','guild_reaction_roles','guild_bosses','warnings','tickets','reminders','bot_statistics','lottery_rounds','afk_users','blacklist'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t',table_name) into rows;
  result := result || jsonb_build_object(table_name,rows);
 end loop;
 return jsonb_build_object('rows',result,'original',original,'revision',(select revision from public.bot_runtime where id=true));
end; $$;
create or replace function public.runtime_commit(instance uuid, expected_revision bigint, operation uuid, changes jsonb, actor text default 'bot') returns bigint
language plpgsql security invoker set search_path='' as $$
declare current_row public.bot_runtime%rowtype; table_name text; columns_sql text; key_columns text;
 assignments text; item jsonb; prior jsonb; next_row jsonb; predicate text; affected bigint; digest text := md5(changes::text);
begin
 select * into current_row from public.bot_runtime where id=true for update;
 if current_row.owner is distinct from instance or current_row.expires_at <= now() then raise exception 'Runtime lease expired'; end if;
 if current_row.last_operation=operation then
   if current_row.last_digest<>digest then raise exception 'Operation ID reused with different data'; end if;
   return current_row.revision;
 end if;
 if current_row.revision<>expected_revision then raise exception 'Runtime version changed' using errcode='40001'; end if;
 if jsonb_typeof(changes) is distinct from 'object' then raise exception 'Invalid runtime changes'; end if;
 if exists(select 1 from jsonb_object_keys(changes) k where k not in ('guilds','users','guild_settings','user_profiles','user_economy','user_inventory','user_animals','user_pets','user_weapons','user_music_favorites','user_quests','user_statistics','user_achievements','user_marriages','user_music_playlists','moderation_cases','guild_music_panels','guild_music_history','guild_reaction_roles','guild_bosses','warnings','tickets','reminders','bot_statistics','lottery_rounds','afk_users','blacklist')) then raise exception 'Unknown runtime table'; end if;
 for prior in select value from jsonb_array_elements(coalesce(changes->'blacklist'->'deletes','[]'::jsonb)) loop
 delete from public.blacklist t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in blacklist' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'afk_users'->'deletes','[]'::jsonb)) loop
 delete from public.afk_users t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in afk_users' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'lottery_rounds'->'deletes','[]'::jsonb)) loop
 delete from public.lottery_rounds t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in lottery_rounds' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'bot_statistics'->'deletes','[]'::jsonb)) loop
 delete from public.bot_statistics t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in bot_statistics' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'reminders'->'deletes','[]'::jsonb)) loop
 delete from public.reminders t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in reminders' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'tickets'->'deletes','[]'::jsonb)) loop
 delete from public.tickets t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in tickets' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'warnings'->'deletes','[]'::jsonb)) loop
 delete from public.warnings t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in warnings' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'guild_bosses'->'deletes','[]'::jsonb)) loop
 delete from public.guild_bosses t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_bosses' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'guild_reaction_roles'->'deletes','[]'::jsonb)) loop
 delete from public.guild_reaction_roles t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_reaction_roles' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'guild_music_history'->'deletes','[]'::jsonb)) loop
 delete from public.guild_music_history t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_music_history' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'guild_music_panels'->'deletes','[]'::jsonb)) loop
 delete from public.guild_music_panels t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_music_panels' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'moderation_cases'->'deletes','[]'::jsonb)) loop
 delete from public.moderation_cases t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in moderation_cases' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_music_playlists'->'deletes','[]'::jsonb)) loop
 delete from public.user_music_playlists t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_music_playlists' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_marriages'->'deletes','[]'::jsonb)) loop
 delete from public.user_marriages t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_marriages' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_achievements'->'deletes','[]'::jsonb)) loop
 delete from public.user_achievements t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_achievements' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_statistics'->'deletes','[]'::jsonb)) loop
 delete from public.user_statistics t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_statistics' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_quests'->'deletes','[]'::jsonb)) loop
 delete from public.user_quests t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_quests' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_music_favorites'->'deletes','[]'::jsonb)) loop
 delete from public.user_music_favorites t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_music_favorites' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_weapons'->'deletes','[]'::jsonb)) loop
 delete from public.user_weapons t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_weapons' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_pets'->'deletes','[]'::jsonb)) loop
 delete from public.user_pets t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_pets' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_animals'->'deletes','[]'::jsonb)) loop
 delete from public.user_animals t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_animals' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_inventory'->'deletes','[]'::jsonb)) loop
 delete from public.user_inventory t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_inventory' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_economy'->'deletes','[]'::jsonb)) loop
 delete from public.user_economy t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_economy' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'user_profiles'->'deletes','[]'::jsonb)) loop
 delete from public.user_profiles t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_profiles' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'guild_settings'->'deletes','[]'::jsonb)) loop
 delete from public.guild_settings t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_settings' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'users'->'deletes','[]'::jsonb)) loop
 delete from public.users t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in users' using errcode='40001'; end if;
 end loop;
 for prior in select value from jsonb_array_elements(coalesce(changes->'guilds'->'deletes','[]'::jsonb)) loop
 delete from public.guilds t where to_jsonb(t) @> prior;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guilds' using errcode='40001'; end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'guilds'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.guilds(id) select n.id from jsonb_populate_record(null::public.guilds,next_row) n;
 else
  update public.guilds t set id=n.id, updated_at=now() from jsonb_populate_record(null::public.guilds,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guilds' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'users'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.users(id) select n.id from jsonb_populate_record(null::public.users,next_row) n;
 else
  update public.users t set id=n.id, updated_at=now() from jsonb_populate_record(null::public.users,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in users' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'guild_settings'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.guild_settings(guild_id, data) select n.guild_id, n.data from jsonb_populate_record(null::public.guild_settings,next_row) n;
 else
  update public.guild_settings t set data=n.data, updated_at=now(), version=t.version+1 from jsonb_populate_record(null::public.guild_settings,next_row) n
   where t.guild_id=n.guild_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_settings' using errcode='40001'; end if;
 end if;
 insert into public.audit_logs(actor_id,guild_id,action,before_data,after_data) values(actor,next_row->>'guild_id','runtime.guild_settings',prior,next_row);
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_profiles'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_profiles(user_id, data) select n.user_id, n.data from jsonb_populate_record(null::public.user_profiles,next_row) n;
 else
  update public.user_profiles t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_profiles,next_row) n
   where t.user_id=n.user_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_profiles' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_economy'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_economy(user_id, balance, bank, data) select n.user_id, n.balance, n.bank, n.data from jsonb_populate_record(null::public.user_economy,next_row) n;
 else
  update public.user_economy t set balance=n.balance, bank=n.bank, data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_economy,next_row) n
   where t.user_id=n.user_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_economy' using errcode='40001'; end if;
 end if;
 insert into public.audit_logs(actor_id,guild_id,action,before_data,after_data) values(actor,null,'runtime.user_economy',prior,next_row);
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_inventory'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_inventory(user_id, item_id, quantity) select n.user_id, n.item_id, n.quantity from jsonb_populate_record(null::public.user_inventory,next_row) n;
 else
  update public.user_inventory t set quantity=n.quantity, updated_at=now() from jsonb_populate_record(null::public.user_inventory,next_row) n
   where t.user_id=n.user_id and t.item_id=n.item_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_inventory' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_animals'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_animals(id, user_id, data) select n.id, n.user_id, n.data from jsonb_populate_record(null::public.user_animals,next_row) n;
 else
  update public.user_animals t set user_id=n.user_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_animals,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_animals' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_pets'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_pets(id, user_id, data) select n.id, n.user_id, n.data from jsonb_populate_record(null::public.user_pets,next_row) n;
 else
  update public.user_pets t set user_id=n.user_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_pets,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_pets' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_weapons'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_weapons(id, user_id, data) select n.id, n.user_id, n.data from jsonb_populate_record(null::public.user_weapons,next_row) n;
 else
  update public.user_weapons t set user_id=n.user_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_weapons,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_weapons' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_music_favorites'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_music_favorites(id, user_id, data) select n.id, n.user_id, n.data from jsonb_populate_record(null::public.user_music_favorites,next_row) n;
 else
  update public.user_music_favorites t set user_id=n.user_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_music_favorites,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_music_favorites' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_quests'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_quests(user_id, data) select n.user_id, n.data from jsonb_populate_record(null::public.user_quests,next_row) n;
 else
  update public.user_quests t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_quests,next_row) n
   where t.user_id=n.user_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_quests' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_statistics'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_statistics(user_id, data) select n.user_id, n.data from jsonb_populate_record(null::public.user_statistics,next_row) n;
 else
  update public.user_statistics t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_statistics,next_row) n
   where t.user_id=n.user_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_statistics' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_achievements'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_achievements(user_id, achievement_id) select n.user_id, n.achievement_id from jsonb_populate_record(null::public.user_achievements,next_row) n;
 else
  update public.user_achievements t set user_id=n.user_id, updated_at=now() from jsonb_populate_record(null::public.user_achievements,next_row) n
   where t.user_id=n.user_id and t.achievement_id=n.achievement_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_achievements' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_marriages'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_marriages(user_id, partner_id, data) select n.user_id, n.partner_id, n.data from jsonb_populate_record(null::public.user_marriages,next_row) n;
 else
  update public.user_marriages t set partner_id=n.partner_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_marriages,next_row) n
   where t.user_id=n.user_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_marriages' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'user_music_playlists'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.user_music_playlists(user_id, name, data) select n.user_id, n.name, n.data from jsonb_populate_record(null::public.user_music_playlists,next_row) n;
 else
  update public.user_music_playlists t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.user_music_playlists,next_row) n
   where t.user_id=n.user_id and t.name=n.name and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in user_music_playlists' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'moderation_cases'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.moderation_cases(id, guild_id, data) select n.id, n.guild_id, n.data from jsonb_populate_record(null::public.moderation_cases,next_row) n;
 else
  update public.moderation_cases t set guild_id=n.guild_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.moderation_cases,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in moderation_cases' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'guild_music_panels'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.guild_music_panels(guild_id, channel_id, message_id, theme, enabled) select n.guild_id, n.channel_id, n.message_id, n.theme, n.enabled from jsonb_populate_record(null::public.guild_music_panels,next_row) n;
 else
  update public.guild_music_panels t set channel_id=n.channel_id, message_id=n.message_id, theme=n.theme, enabled=n.enabled, updated_at=now() from jsonb_populate_record(null::public.guild_music_panels,next_row) n
   where t.guild_id=n.guild_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_music_panels' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'guild_music_history'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.guild_music_history(id, guild_id, data) select n.id, n.guild_id, n.data from jsonb_populate_record(null::public.guild_music_history,next_row) n;
 else
  update public.guild_music_history t set guild_id=n.guild_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.guild_music_history,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_music_history' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'guild_reaction_roles'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.guild_reaction_roles(id, guild_id, data) select n.id, n.guild_id, n.data from jsonb_populate_record(null::public.guild_reaction_roles,next_row) n;
 else
  update public.guild_reaction_roles t set guild_id=n.guild_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.guild_reaction_roles,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_reaction_roles' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'guild_bosses'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.guild_bosses(guild_id, data) select n.guild_id, n.data from jsonb_populate_record(null::public.guild_bosses,next_row) n;
 else
  update public.guild_bosses t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.guild_bosses,next_row) n
   where t.guild_id=n.guild_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in guild_bosses' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'warnings'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.warnings(id, guild_id, user_id, data) select n.id, n.guild_id, n.user_id, n.data from jsonb_populate_record(null::public.warnings,next_row) n;
 else
  update public.warnings t set guild_id=n.guild_id, user_id=n.user_id, data=n.data, updated_at=now() from jsonb_populate_record(null::public.warnings,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in warnings' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'tickets'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.tickets(id, data) select n.id, n.data from jsonb_populate_record(null::public.tickets,next_row) n;
 else
  update public.tickets t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.tickets,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in tickets' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'reminders'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.reminders(id, data) select n.id, n.data from jsonb_populate_record(null::public.reminders,next_row) n;
 else
  update public.reminders t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.reminders,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in reminders' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'bot_statistics'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.bot_statistics(id, data) select n.id, n.data from jsonb_populate_record(null::public.bot_statistics,next_row) n;
 else
  update public.bot_statistics t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.bot_statistics,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in bot_statistics' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'lottery_rounds'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.lottery_rounds(id, data) select n.id, n.data from jsonb_populate_record(null::public.lottery_rounds,next_row) n;
 else
  update public.lottery_rounds t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.lottery_rounds,next_row) n
   where t.id=n.id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in lottery_rounds' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'afk_users'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.afk_users(user_id, data) select n.user_id, n.data from jsonb_populate_record(null::public.afk_users,next_row) n;
 else
  update public.afk_users t set data=n.data, updated_at=now() from jsonb_populate_record(null::public.afk_users,next_row) n
   where t.user_id=n.user_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in afk_users' using errcode='40001'; end if;
 end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(changes->'blacklist'->'upserts','[]'::jsonb)) loop
 prior:=item->'before'; next_row:=item->'after';
 if prior is null or prior='null'::jsonb then
  insert into public.blacklist(user_id) select n.user_id from jsonb_populate_record(null::public.blacklist,next_row) n;
 else
  update public.blacklist t set user_id=n.user_id, updated_at=now() from jsonb_populate_record(null::public.blacklist,next_row) n
   where t.user_id=n.user_id and to_jsonb(t) @> prior;
  get diagnostics affected=row_count; if affected<>1 then raise exception 'Concurrent change in blacklist' using errcode='40001'; end if;
 end if;
 insert into public.audit_logs(actor_id,guild_id,action,before_data,after_data) values(actor,null,'runtime.blacklist',prior,next_row);
 end loop;
 update public.bot_runtime set revision=revision+1,last_operation=operation,last_digest=digest,expires_at=now()+interval '90 seconds' where id=true;
 return expected_revision+1;
end; $$;
revoke all on function public.runtime_lease(uuid,boolean), public.runtime_load(uuid), public.runtime_commit(uuid,bigint,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.runtime_lease(uuid,boolean), public.runtime_load(uuid), public.runtime_commit(uuid,bigint,uuid,jsonb,text) to service_role;
commit;
