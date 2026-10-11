create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto;

create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    filename text not null,
    storage_path text,
    page_count int check (page_count > 0),
    status text not null default 'uploaded'
        check (status in ('uploaded', 'processing', 'ready', 'failed')),
    error_message text,
    uploaded_at timestamptz default now()
);

create table if not exists pages (
    id bigint generated always as identity primary key,
    doc_id uuid not null references documents(id) on delete cascade,
    page_number int not null check (page_number >= 1),
    text text,
    is_scanned bool default false,
    image_path text,
    unique (doc_id, page_number)
);

alter table pages add column if not exists blocks jsonb;
alter table pages add column if not exists extraction_method text
    default 'text'
    check (extraction_method in ('text', 'ocr', 'mixed'));
alter table pages add column if not exists ocr_confidence real;

create table if not exists page_tables (
    id bigint generated always as identity primary key,
    doc_id uuid not null references documents(id) on delete cascade,
    page_number int not null,
    table_index int not null,
    headers jsonb,
    rows jsonb,
    markdown text,
    unique (doc_id, page_number, table_index)
);

create table if not exists chunks (
    id bigint generated always as identity primary key,
    doc_id uuid not null references documents(id) on delete cascade,
    user_id uuid,
    page_number int not null,
    section text,
    content_type text not null check (content_type in ('text', 'table', 'ocr', 'chart')),
    content text not null,
    embedding extensions.vector(384),
    fts tsvector generated always as (to_tsvector('english', content)) stored
);

create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    title text,
    created_at timestamptz default now()
);

create table if not exists messages (
    id bigint generated always as identity primary key,
    conversation_id uuid not null references conversations(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    verification jsonb,
    used_vision bool default false,
    created_at timestamptz default now()
);

create table if not exists citations (
    id bigint generated always as identity primary key,
    message_id bigint not null references messages(id) on delete cascade,
    doc_id uuid not null references documents(id) on delete cascade,
    page_number int not null,
    section text,
    snippet text,
    content_type text
);

create table if not exists eval_results (
    id bigint generated always as identity primary key,
    run_id text not null,
    question_id text not null,
    correct bool,
    citation_correct bool,
    details jsonb,
    created_at timestamptz default now()
);

create index if not exists documents_user_id_idx on documents(user_id);
create index if not exists chunks_doc_page_idx on chunks(doc_id, page_number);
create index if not exists chunks_user_id_idx on chunks(user_id);
create index if not exists chunks_fts_idx on chunks using gin(fts);
create index if not exists chunks_embedding_idx on chunks
    using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists messages_conversation_id_idx
    on messages(conversation_id);
create index if not exists citations_message_id_idx on citations(message_id);
create index if not exists page_tables_doc_page_idx
    on page_tables(doc_id, page_number);

alter table documents enable row level security;
alter table pages enable row level security;
alter table chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table citations enable row level security;
alter table eval_results enable row level security;
alter table page_tables enable row level security;

drop policy if exists documents_owner on documents;
create policy documents_owner on documents
    for all to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists pages_document_owner on pages;
create policy pages_document_owner on pages
    for all to authenticated using (
        exists (
            select 1 from documents
            where documents.id = pages.doc_id
              and documents.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from documents
            where documents.id = pages.doc_id
              and documents.user_id = auth.uid()
        )
    );

drop policy if exists chunks_owner on chunks;
create policy chunks_owner on chunks
    for all to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists conversations_owner on conversations;
create policy conversations_owner on conversations
    for all to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists messages_conversation_owner on messages;
create policy messages_conversation_owner on messages
    for all to authenticated using (
        exists (
            select 1 from conversations
            where conversations.id = messages.conversation_id
              and conversations.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from conversations
            where conversations.id = messages.conversation_id
              and conversations.user_id = auth.uid()
        )
    );

drop policy if exists citations_conversation_owner on citations;
create policy citations_conversation_owner on citations
    for all to authenticated using (
        exists (
            select 1
            from messages
            join conversations on conversations.id = messages.conversation_id
            where messages.id = citations.message_id
              and conversations.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1
            from messages
            join conversations on conversations.id = messages.conversation_id
            where messages.id = citations.message_id
              and conversations.user_id = auth.uid()
        )
    );

drop policy if exists page_tables_document_owner on page_tables;
create policy page_tables_document_owner on page_tables
    for all to authenticated using (
        exists (
            select 1 from documents
            where documents.id = page_tables.doc_id
              and documents.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from documents
            where documents.id = page_tables.doc_id
              and documents.user_id = auth.uid()
        )
    );
