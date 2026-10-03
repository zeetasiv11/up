-- Zeechei V4 foundation. Run once in the Supabase SQL editor.
begin;
create table if not exists public.guilds (
    id text primary key,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.users (
    id text primary key,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.guild_settings (
    guild_id text primary key references public.guilds(id),
    data jsonb not null default '{}'::jsonb,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_profiles (
    user_id text primary key references public.users(id),
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_economy (
    user_id text primary key references public.users(id),
    balance bigint not null default 0 check (balance between 0 and 9007199254740991),
    bank bigint not null default 0 check (bank between 0 and 9007199254740991),
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_inventory (
    user_id text not null references public.users(id),
    item_id text not null,
    quantity bigint not null check (quantity between 0 and 9007199254740991),
    primary key (user_id, item_id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_animals (
    id text primary key,
    user_id text not null references public.users(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists user_animals_user_id_idx on public.user_animals(user_id);
create table if not exists public.user_pets (
    id text primary key,
    user_id text not null references public.users(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists user_pets_user_id_idx on public.user_pets(user_id);
create table if not exists public.user_weapons (
    id text primary key,
    user_id text not null references public.users(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists user_weapons_user_id_idx on public.user_weapons(user_id);
create table if not exists public.user_music_favorites (
    id text primary key,
    user_id text not null references public.users(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists user_music_favorites_user_id_idx on public.user_music_favorites(user_id);
create table if not exists public.user_quests (
    user_id text primary key references public.users(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_statistics (
    user_id text primary key references public.users(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_achievements (
    user_id text not null references public.users(id),
    achievement_id text not null,
    primary key (user_id, achievement_id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_marriages (
    user_id text primary key references public.users(id),
    partner_id text not null,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_music_playlists (
    user_id text not null references public.users(id),
    name text not null,
    data jsonb not null,
    primary key (user_id, name),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.guild_music_panels (
    guild_id text primary key references public.guilds(id),
    channel_id text not null,
    message_id text not null,
    theme text not null default 'zeechei',
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.guild_music_history (
    id text primary key,
    guild_id text not null references public.guilds(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists guild_music_history_guild_id_idx on public.guild_music_history(guild_id);
create table if not exists public.guild_reaction_roles (
    id text primary key,
    guild_id text not null references public.guilds(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists guild_reaction_roles_guild_id_idx on public.guild_reaction_roles(guild_id);
create table if not exists public.guild_bosses (
    guild_id text primary key references public.guilds(id),
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.warnings (
    id text primary key,
    guild_id text not null,
    user_id text not null,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists warnings_guild_id_idx on public.warnings(guild_id);
create index if not exists warnings_user_id_idx on public.warnings(user_id);
create table if not exists public.tickets (
    id text primary key,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.reminders (
    id text primary key,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.bot_statistics (
    id text primary key,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.lottery_rounds (
    id text primary key,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.afk_users (
    user_id text primary key,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.blacklist (
    user_id text primary key,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.legacy_imports (
    source_hash text primary key, payload_hash text not null, original jsonb not null,
    counts jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
    id bigint generated always as identity primary key,
    actor_id text not null, guild_id text, action text not null,
    before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create index if not exists audit_logs_guild_time on public.audit_logs(guild_id, created_at desc);
create table if not exists public.economy_operations (
    id text primary key, request jsonb not null, result jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.economy_transactions (
    id text primary key references public.economy_operations(id),
    from_id text not null references public.users(id), to_id text not null references public.users(id),
    amount bigint not null check (amount > 0), created_at timestamptz not null default now()
);
alter table public.guilds enable row level security;
revoke all on public.guilds from public, anon, authenticated;
grant select, insert, update, delete on public.guilds to service_role;
alter table public.users enable row level security;
revoke all on public.users from public, anon, authenticated;
grant select, insert, update, delete on public.users to service_role;
alter table public.guild_settings enable row level security;
revoke all on public.guild_settings from public, anon, authenticated;
grant select, insert, update, delete on public.guild_settings to service_role;
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;
alter table public.user_economy enable row level security;
revoke all on public.user_economy from public, anon, authenticated;
grant select, insert, update, delete on public.user_economy to service_role;
alter table public.user_inventory enable row level security;
revoke all on public.user_inventory from public, anon, authenticated;
grant select, insert, update, delete on public.user_inventory to service_role;
alter table public.user_animals enable row level security;
revoke all on public.user_animals from public, anon, authenticated;
grant select, insert, update, delete on public.user_animals to service_role;
alter table public.user_pets enable row level security;
revoke all on public.user_pets from public, anon, authenticated;
grant select, insert, update, delete on public.user_pets to service_role;
alter table public.user_weapons enable row level security;
revoke all on public.user_weapons from public, anon, authenticated;
grant select, insert, update, delete on public.user_weapons to service_role;
alter table public.user_music_favorites enable row level security;
revoke all on public.user_music_favorites from public, anon, authenticated;
grant select, insert, update, delete on public.user_music_favorites to service_role;
alter table public.user_quests enable row level security;
revoke all on public.user_quests from public, anon, authenticated;
grant select, insert, update, delete on public.user_quests to service_role;
alter table public.user_statistics enable row level security;
revoke all on public.user_statistics from public, anon, authenticated;
grant select, insert, update, delete on public.user_statistics to service_role;
alter table public.user_achievements enable row level security;
revoke all on public.user_achievements from public, anon, authenticated;
grant select, insert, update, delete on public.user_achievements to service_role;
alter table public.user_marriages enable row level security;
revoke all on public.user_marriages from public, anon, authenticated;
grant select, insert, update, delete on public.user_marriages to service_role;
alter table public.user_music_playlists enable row level security;
revoke all on public.user_music_playlists from public, anon, authenticated;
grant select, insert, update, delete on public.user_music_playlists to service_role;
alter table public.guild_music_panels enable row level security;
revoke all on public.guild_music_panels from public, anon, authenticated;
grant select, insert, update, delete on public.guild_music_panels to service_role;
alter table public.guild_music_history enable row level security;
revoke all on public.guild_music_history from public, anon, authenticated;
grant select, insert, update, delete on public.guild_music_history to service_role;
alter table public.guild_reaction_roles enable row level security;
revoke all on public.guild_reaction_roles from public, anon, authenticated;
grant select, insert, update, delete on public.guild_reaction_roles to service_role;
alter table public.guild_bosses enable row level security;
revoke all on public.guild_bosses from public, anon, authenticated;
grant select, insert, update, delete on public.guild_bosses to service_role;
alter table public.warnings enable row level security;
revoke all on public.warnings from public, anon, authenticated;
grant select, insert, update, delete on public.warnings to service_role;
alter table public.tickets enable row level security;
revoke all on public.tickets from public, anon, authenticated;
grant select, insert, update, delete on public.tickets to service_role;
alter table public.reminders enable row level security;
revoke all on public.reminders from public, anon, authenticated;
grant select, insert, update, delete on public.reminders to service_role;
alter table public.bot_statistics enable row level security;
revoke all on public.bot_statistics from public, anon, authenticated;
grant select, insert, update, delete on public.bot_statistics to service_role;
alter table public.lottery_rounds enable row level security;
revoke all on public.lottery_rounds from public, anon, authenticated;
grant select, insert, update, delete on public.lottery_rounds to service_role;
alter table public.afk_users enable row level security;
revoke all on public.afk_users from public, anon, authenticated;
grant select, insert, update, delete on public.afk_users to service_role;
alter table public.blacklist enable row level security;
revoke all on public.blacklist from public, anon, authenticated;
grant select, insert, update, delete on public.blacklist to service_role;
alter table public.legacy_imports enable row level security;
revoke all on public.legacy_imports from public, anon, authenticated;
grant select, insert, update, delete on public.legacy_imports to service_role;
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated;
grant select, insert, update, delete on public.audit_logs to service_role;
alter table public.economy_operations enable row level security;
revoke all on public.economy_operations from public, anon, authenticated;
grant select, insert, update, delete on public.economy_operations to service_role;
alter table public.economy_transactions enable row level security;
revoke all on public.economy_transactions from public, anon, authenticated;
grant select, insert, update, delete on public.economy_transactions to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;
create or replace function public.verify_legacy(payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
    table_name text; item jsonb; matched bigint; checked bigint; expected bigint;
    result jsonb := '{}'::jsonb; all_ok boolean := true;
begin
    foreach table_name in array array['guilds', 'users', 'moderation_cases', 'guild_settings', 'user_profiles', 'user_economy', 'user_inventory', 'user_animals', 'user_pets', 'user_weapons', 'user_music_favorites', 'user_quests', 'user_statistics', 'user_achievements', 'user_marriages', 'user_music_playlists', 'guild_music_panels', 'guild_music_history', 'guild_reaction_roles', 'guild_bosses', 'warnings', 'tickets', 'reminders', 'bot_statistics', 'lottery_rounds', 'afk_users', 'blacklist'] loop
        if jsonb_typeof(payload->table_name) is distinct from 'array' then
            raise exception 'Invalid payload table %', table_name;
        end if;
        expected := jsonb_array_length(payload->table_name); checked := 0;
        for item in select value from jsonb_array_elements(payload->table_name) loop
            execute format('select count(*) from public.%I t where to_jsonb(t) @> $1', table_name) into matched using item;
            if matched = 1 then checked := checked + 1; end if;
        end loop;
        result := result || jsonb_build_object(table_name, jsonb_build_object('expected', expected, 'matched', checked));
        all_ok := all_ok and checked = expected;
    end loop;
    return jsonb_build_object('ok', all_ok, 'tables', result);
end;
$$;
create or replace function public.import_legacy(source_hash text, payload jsonb, original jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
    previous public.legacy_imports%rowtype; counts jsonb := '{}'::jsonb;
    table_name text; digest text := md5(payload::text || original::text); verification jsonb;
begin
    if source_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(original) is distinct from 'object' then
        raise exception 'Invalid migration identity';
    end if;
    perform pg_advisory_xact_lock(837462901);
    select * into previous from public.legacy_imports i where i.source_hash = import_legacy.source_hash;
    if found then
        if previous.payload_hash <> digest then raise exception 'Snapshot fingerprint collision'; end if;
        return jsonb_build_object('alreadyImported', true, 'counts', previous.counts);
    end if;
    foreach table_name in array array['guilds', 'users', 'moderation_cases', 'guild_settings', 'user_profiles', 'user_economy', 'user_inventory', 'user_animals', 'user_pets', 'user_weapons', 'user_music_favorites', 'user_quests', 'user_statistics', 'user_achievements', 'user_marriages', 'user_music_playlists', 'guild_music_panels', 'guild_music_history', 'guild_reaction_roles', 'guild_bosses', 'warnings', 'tickets', 'reminders', 'bot_statistics', 'lottery_rounds', 'afk_users', 'blacklist'] loop
        if jsonb_typeof(payload->table_name) is distinct from 'array' then raise exception 'Invalid payload'; end if;
        counts := counts || jsonb_build_object(table_name, jsonb_array_length(payload->table_name));
    end loop;
    insert into public.guilds (id) select id from jsonb_populate_recordset(null::public.guilds, payload->'guilds');
    insert into public.users (id) select id from jsonb_populate_recordset(null::public.users, payload->'users');
    insert into public.moderation_cases (id, guild_id, data) select id, guild_id, data from jsonb_populate_recordset(null::public.moderation_cases, payload->'moderation_cases');
    insert into public.guild_settings (guild_id, data) select guild_id, data from jsonb_populate_recordset(null::public.guild_settings, payload->'guild_settings');
    insert into public.user_profiles (user_id, data) select user_id, data from jsonb_populate_recordset(null::public.user_profiles, payload->'user_profiles');
    insert into public.user_economy (user_id, balance, bank, data) select user_id, balance, bank, data from jsonb_populate_recordset(null::public.user_economy, payload->'user_economy');
    insert into public.user_inventory (user_id, item_id, quantity) select user_id, item_id, quantity from jsonb_populate_recordset(null::public.user_inventory, payload->'user_inventory');
    insert into public.user_animals (id, user_id, data) select id, user_id, data from jsonb_populate_recordset(null::public.user_animals, payload->'user_animals');
    insert into public.user_pets (id, user_id, data) select id, user_id, data from jsonb_populate_recordset(null::public.user_pets, payload->'user_pets');
    insert into public.user_weapons (id, user_id, data) select id, user_id, data from jsonb_populate_recordset(null::public.user_weapons, payload->'user_weapons');
    insert into public.user_music_favorites (id, user_id, data) select id, user_id, data from jsonb_populate_recordset(null::public.user_music_favorites, payload->'user_music_favorites');
    insert into public.user_quests (user_id, data) select user_id, data from jsonb_populate_recordset(null::public.user_quests, payload->'user_quests');
    insert into public.user_statistics (user_id, data) select user_id, data from jsonb_populate_recordset(null::public.user_statistics, payload->'user_statistics');
    insert into public.user_achievements (user_id, achievement_id) select user_id, achievement_id from jsonb_populate_recordset(null::public.user_achievements, payload->'user_achievements');
    insert into public.user_marriages (user_id, partner_id, data) select user_id, partner_id, data from jsonb_populate_recordset(null::public.user_marriages, payload->'user_marriages');
    insert into public.user_music_playlists (user_id, name, data) select user_id, name, data from jsonb_populate_recordset(null::public.user_music_playlists, payload->'user_music_playlists');
    insert into public.guild_music_panels (guild_id, channel_id, message_id, theme, enabled) select guild_id, channel_id, message_id, theme, enabled from jsonb_populate_recordset(null::public.guild_music_panels, payload->'guild_music_panels');
    insert into public.guild_music_history (id, guild_id, data) select id, guild_id, data from jsonb_populate_recordset(null::public.guild_music_history, payload->'guild_music_history');
    insert into public.guild_reaction_roles (id, guild_id, data) select id, guild_id, data from jsonb_populate_recordset(null::public.guild_reaction_roles, payload->'guild_reaction_roles');
    insert into public.guild_bosses (guild_id, data) select guild_id, data from jsonb_populate_recordset(null::public.guild_bosses, payload->'guild_bosses');
    insert into public.warnings (id, guild_id, user_id, data) select id, guild_id, user_id, data from jsonb_populate_recordset(null::public.warnings, payload->'warnings');
    insert into public.tickets (id, data) select id, data from jsonb_populate_recordset(null::public.tickets, payload->'tickets');
    insert into public.reminders (id, data) select id, data from jsonb_populate_recordset(null::public.reminders, payload->'reminders');
    insert into public.bot_statistics (id, data) select id, data from jsonb_populate_recordset(null::public.bot_statistics, payload->'bot_statistics');
    insert into public.lottery_rounds (id, data) select id, data from jsonb_populate_recordset(null::public.lottery_rounds, payload->'lottery_rounds');
    insert into public.afk_users (user_id, data) select user_id, data from jsonb_populate_recordset(null::public.afk_users, payload->'afk_users');
    insert into public.blacklist (user_id) select user_id from jsonb_populate_recordset(null::public.blacklist, payload->'blacklist');
    verification := public.verify_legacy(payload);
    if not (verification->>'ok')::boolean then raise exception 'Migration verification failed'; end if;
    insert into public.legacy_imports(source_hash, payload_hash, original, counts) values (source_hash, digest, original, counts);
    return jsonb_build_object('alreadyImported', false, 'counts', counts, 'verification', verification);
end;
$$;
revoke all on function public.import_legacy(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.verify_legacy(jsonb) from public, anon, authenticated;
grant execute on function public.import_legacy(text, jsonb, jsonb) to service_role;
grant execute on function public.verify_legacy(jsonb) to service_role;

create or replace function public.transfer_balance(operation_id text, sender text, recipient text, amount bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    prior public.economy_operations%rowtype; request jsonb;
    sender_balance bigint; recipient_balance bigint; result jsonb;
begin
    if operation_id is null or length(operation_id) not between 1 and 200 or sender is null or recipient is null
        or sender = recipient or amount is null or amount <= 0 or amount > 9007199254740991 then
        raise exception 'Invalid transfer';
    end if;
    request := jsonb_build_object('sender', sender, 'recipient', recipient, 'amount', amount);
    perform pg_advisory_xact_lock(hashtextextended(operation_id, 0));
    select * into prior from public.economy_operations where id = operation_id;
    if found then
        if prior.request <> request then raise exception 'Idempotency key reused with different transfer'; end if;
        return prior.result;
    end if;
    perform user_id from public.user_economy where user_id in (sender, recipient) order by user_id for update;
    select balance into sender_balance from public.user_economy where user_id = sender;
    select balance into recipient_balance from public.user_economy where user_id = recipient;
    if sender_balance is null or recipient_balance is null then raise exception 'Unknown account'; end if;
    if sender_balance < amount then raise exception 'Insufficient balance'; end if;
    if recipient_balance > 9007199254740991 - amount then raise exception 'Balance limit'; end if;
    update public.user_economy set balance = balance - amount, updated_at = now() where user_id = sender;
    update public.user_economy set balance = balance + amount, updated_at = now() where user_id = recipient;
    result := jsonb_build_object('senderBalance', sender_balance - amount, 'recipientBalance', recipient_balance + amount);
    insert into public.economy_operations(id, request, result) values (operation_id, request, result);
    insert into public.economy_transactions(id, from_id, to_id, amount) values (operation_id, sender, recipient, amount);
    insert into public.audit_logs(actor_id, action, before_data, after_data)
    values (sender, 'economy.transfer', jsonb_build_object('balance', sender_balance), result);
    return result;
end;
$$;
revoke all on function public.transfer_balance(text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.transfer_balance(text, text, text, bigint) to service_role;

create or replace function public.update_guild_settings(target_guild text, expected_version bigint, next_data jsonb, actor text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.guild_settings%rowtype;
begin
    if jsonb_typeof(next_data) is distinct from 'object' or actor is null or actor = '' then raise exception 'Invalid settings'; end if;
    select * into current_row from public.guild_settings where guild_id = target_guild for update;
    if not found or current_row.version <> expected_version then raise exception 'Settings changed; reload before saving' using errcode = '40001'; end if;
    update public.guild_settings set data = next_data, version = version + 1, updated_at = now() where guild_id = target_guild;
    insert into public.audit_logs(actor_id, guild_id, action, before_data, after_data)
    values(actor, target_guild, 'settings.update', current_row.data, next_data);
    return jsonb_build_object('data', next_data, 'version', current_row.version + 1);
end;
$$;
revoke all on function public.update_guild_settings(text, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.update_guild_settings(text, bigint, jsonb, text) to service_role;
create table if not exists public.moderation_cases (
 id text primary key, guild_id text not null references public.guilds(id), data jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists moderation_cases_guild_idx on public.moderation_cases(guild_id);
alter table public.moderation_cases enable row level security;
revoke all on public.moderation_cases from public, anon, authenticated;
grant select,insert,update,delete on public.moderation_cases to service_role;
commit;
