-- Supplementary schema: conversations/messages/entities/docs
-- Keep PKs as text; ChittyID via MCP at app layer

create table if not exists conversation(
  conv_id text primary key,
  source text not null,
  thread_key text,
  started_at timestamptz,
  ended_at timestamptz,
  direction text
);

create table if not exists message(
  msg_id text primary key,
  conv_id text references conversation(conv_id) on delete cascade,
  ts timestamptz not null,
  sender text,
  receiver text,
  channel text,
  text text,
  raw jsonb
);

create table if not exists entity(
  entity_id text primary key,
  type text not null check (type in ('resident','lease','unit','property','vendor','bill','project','company','document')),
  stage text not null default 'unknown',
  external_ref text unique,
  attrs jsonb default '{}'
);

create table if not exists entity_link(
  conv_id text references conversation(conv_id) on delete cascade,
  entity_id text references entity(entity_id) on delete cascade,
  link_type text,
  link_reason text,
  confidence numeric,
  primary key (conv_id, entity_id)
);

create table if not exists document(
  doc_id text primary key,
  type text not null,
  subtype text,
  issuer_name text,
  issuer_id text,
  counterparty_name text,
  counterparty_id text,
  doc_number text,
  issue_date date,
  effective_date date,
  due_date date,
  currency text,
  amount numeric,
  tax numeric,
  status text not null default 'draft',
  storage_uri text not null,
  sha256 char(64) not null unique,
  signature_valid boolean,
  signature_meta jsonb,
  ocr_lang text,
  ocr_text tsvector,
  extracted jsonb default '{}',
  version int default 1,
  supersedes_doc_id text
);

create table if not exists document_link(
  doc_id text references document(doc_id) on delete cascade,
  entity_id text not null,
  link_type text,
  confidence numeric,
  provenance jsonb,
  primary key (doc_id, entity_id)
);

-- fingerprints + dedupe clusters
create table if not exists fingerprint(
  fp_id text primary key,
  sha256 char(64),
  phash char(16),
  text_fp char(64),
  meta jsonb
);

create table if not exists duplicate_cluster(
  cluster_id text primary key,
  object_type text not null,
  canonical_id text not null
);

create table if not exists duplicate_map(
  cluster_id text references duplicate_cluster(cluster_id) on delete cascade,
  object_id text not null,
  reason text,
  similarity numeric,
  primary key (cluster_id, object_id)
);

