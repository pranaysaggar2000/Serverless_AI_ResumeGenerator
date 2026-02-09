# Database Schema

## Overview

ForgeCV API uses Supabase (PostgreSQL) for user authentication and usage tracking.

## Tables

### `auth.users` (Supabase managed)

Built-in Supabase authentication table. Automatically managed by Supabase Auth.

**Columns:**
- `id` (UUID, PK) - User ID
- `email` (TEXT) - User email
- `created_at` (TIMESTAMPTZ) - Account creation time
- `last_sign_in_at` (TIMESTAMPTZ) - Last login time
- ... (other Supabase auth fields)

**Usage:**
- Automatically populated when users sign in with Google OAuth
- Referenced by `usage.user_id` foreign key

---

### `public.usage`

Tracks daily AI action usage per user for rate limiting.

**Columns:**
- `id` (UUID, PK, default: `gen_random_uuid()`) - Unique usage record ID
- `user_id` (UUID, FK → `auth.users.id`, NOT NULL) - User who performed action
- `action_type` (TEXT, NOT NULL) - Type of action (e.g., 'jdParse', 'tailor', 'score', 'default')
- `created_at` (TIMESTAMPTZ, default: `NOW()`) - When action was performed

**Indexes:**
- `idx_usage_user_date` on `(user_id, created_at)` - Optimizes daily usage queries

**Row Level Security (RLS):**
- Enabled (optional)
- Policy: "Users can view own usage" - `SELECT` allowed where `auth.uid() = user_id`

**Usage:**
- Each AI generation request creates one row
- Daily limit checked by counting rows where `user_id` matches and `created_at >= today 00:00 UTC`
- Old records can be archived/deleted after 30+ days for cleanup

---

## SQL Setup

```sql
-- Create usage table
CREATE TABLE public.usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_id TEXT, -- Unique ID for the action to prevent double-counting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_usage_user_date ON public.usage(user_id, created_at);

-- Enable RLS
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (optional)
CREATE POLICY "Users can view own usage"
  ON public.usage
  FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Queries

### Count Today's Usage for User

```sql
SELECT COUNT(*) 
FROM public.usage
WHERE user_id = $1
  AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
```

### Get User's Recent Actions

```sql
SELECT action_type, created_at
FROM public.usage
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

### Daily Usage Stats (Admin)

```sql
SELECT 
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS total_actions,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

### Cleanup Old Records (Optional)

```sql
-- Delete usage records older than 90 days
DELETE FROM public.usage
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Data Retention

**Recommended:**
- Keep usage records for 30-90 days
- Archive or delete older records to save storage
- Set up a cron job (Supabase Edge Functions or external) to clean up old data

**Example Cleanup Function:**

```sql
CREATE OR REPLACE FUNCTION cleanup_old_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM public.usage
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available)
SELECT cron.schedule(
  'cleanup-usage',
  '0 2 * * *',  -- Daily at 2 AM UTC
  'SELECT cleanup_old_usage();'
);
```

---

## Monitoring

### Check Table Size

```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('public.usage')) AS total_size,
  COUNT(*) AS row_count
FROM public.usage;
```

### Top Users by Usage

```sql
SELECT 
  user_id,
  COUNT(*) AS action_count,
  MAX(created_at) AS last_action
FROM public.usage
WHERE created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
GROUP BY user_id
ORDER BY action_count DESC
LIMIT 10;
```

---

## Security Notes

1. **Service Role Key**: API uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for server-side operations
2. **Foreign Key Cascade**: When a user is deleted from `auth.users`, their usage records are automatically deleted (`ON DELETE CASCADE`)
3. **RLS Policies**: Optional - can be used if you want users to query their own usage directly
4. **Index Performance**: The `idx_usage_user_date` index is critical for fast daily usage queries

---

## Future Enhancements

Potential schema additions:

### `public.user_subscriptions` (Premium tier)

```sql
CREATE TABLE public.user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,  -- 'free', 'pro', 'enterprise'
  daily_limit INTEGER NOT NULL DEFAULT 15,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL,  -- 'active', 'canceled', 'past_due'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `public.api_keys` (BYOK mode tracking)

```sql
CREATE TABLE public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'openrouter', 'groq', 'openai'
  key_hash TEXT NOT NULL,  -- Hashed API key for security
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

### `public.prompt_audit` (Security Monitoring)

Tracks suspicious or low-quality prompts to detect API abuse or injection attempts.

```sql
CREATE TABLE public.prompt_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marker_hits INTEGER,      -- Number of "ForgeCV" markers found
    prompt_preview TEXT,      -- Truncated preview of the prompt
    task_type TEXT,          -- Type of AI task (tailor, score, etc)
    flagged BOOLEAN DEFAULT false, -- True if prompt was blocked
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for monitoring performance
CREATE INDEX idx_prompt_audit_flagged ON public.prompt_audit(flagged, created_at);
```
