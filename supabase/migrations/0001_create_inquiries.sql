create table if not exists public.inquiries (
  id text primary key,
  "createdAt" timestamptz not null default now(),
  "sourcePage" text not null,
  "sessionId" text not null,
  "inquiryIntent" text null,
  "businessCategory" text null,
  summary text not null,
  "rawMessages" jsonb not null default '[]'::jsonb,
  organization text null,
  name text null,
  email text null,
  phone text null,
  "inquiryBody" text null,
  budget text null,
  deadline text null,
  urgency text not null check (urgency in ('low', 'medium', 'high')),
  "needsHuman" boolean not null default false,
  status text not null check (status in ('new', 'reviewing', 'closed'))
);

create index if not exists inquiries_created_at_idx on public.inquiries ("createdAt" desc);
create index if not exists inquiries_status_idx on public.inquiries (status);

alter table public.inquiries enable row level security;

revoke all on table public.inquiries from anon;
revoke all on table public.inquiries from authenticated;
