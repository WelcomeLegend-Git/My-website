-- PostgreSQL schema for the Ludo feature. Convert to Prisma models during the approved server merge.

create table if not exists ludo_guest_sessions (
  id uuid primary key,
  display_name varchar(16) not null,
  token_hash varchar(128) not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists ludo_rooms (
  id uuid primary key,
  code char(5) not null unique,
  invite_secret_hash varchar(128) not null,
  host_guest_session_id uuid references ludo_guest_sessions(id),
  status varchar(16) not null default 'waiting',
  mode varchar(16) not null default 'online',
  rules jsonb not null,
  game_state jsonb not null,
  revision integer not null default 0,
  turn_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists ludo_room_players (
  id uuid primary key,
  room_id uuid not null references ludo_rooms(id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  colour varchar(8) not null check (colour in ('red', 'blue', 'yellow', 'green')),
  display_name varchar(16) not null,
  user_id text,
  guest_session_id uuid references ludo_guest_sessions(id),
  status varchar(16) not null default 'waiting',
  ping_ms smallint,
  reconnect_until timestamptz,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(room_id, seat),
  unique(room_id, colour)
);

create table if not exists ludo_game_events (
  id uuid primary key,
  room_id uuid not null references ludo_rooms(id) on delete cascade,
  sequence integer not null,
  actor_player_id uuid references ludo_room_players(id),
  kind varchar(24) not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(room_id, sequence)
);

create index if not exists ludo_room_players_room_id_idx on ludo_room_players(room_id);
create index if not exists ludo_game_events_room_sequence_idx on ludo_game_events(room_id, sequence);
create index if not exists ludo_rooms_expires_at_idx on ludo_rooms(expires_at);
