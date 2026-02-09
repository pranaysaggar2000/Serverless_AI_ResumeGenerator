# ForgeCV API Deployment Checklist

## Prerequisites

- [ ] Vercel account created
- [ ] Supabase project created
- [ ] OpenRouter API key obtained
- [ ] Groq API key obtained
- [ ] Google OAuth credentials created

## Supabase Setup

### 1. Create Database Table

```sql
-- Create usage tracking table
CREATE TABLE public.usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_usage_user_date ON public.usage(user_id, created_at);
CREATE INDEX idx_usage_action_id ON public.usage(user_id, action_id);

-- Enable RLS (optional, we use service role)
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Optional: Create RLS policy for user access
CREATE POLICY "Users can view own usage"
  ON public.usage
  FOR SELECT
  USING (auth.uid() = user_id);
```

### 2. Configure Google OAuth

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Enter your Google OAuth Client ID and Secret
4. Add authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### 3. Get Supabase Credentials

From Supabase Dashboard → Settings → API:
- [ ] Copy `SUPABASE_URL`
- [ ] Copy `anon` key → `SUPABASE_ANON_KEY`
- [ ] Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret to Supabase

## Vercel Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Deploy

```bash
cd api
vercel
```

Follow prompts:
- Link to existing project or create new
- Set project name (e.g., `forgecv-api`)
- Deploy

### 3. Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENROUTER_API_KEY=sk-or-v1-...
GROQ_API_KEY=gsk_...
DAILY_ACTION_LIMIT=15
```

Or via CLI:

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENROUTER_API_KEY
vercel env add GROQ_API_KEY
vercel env add DAILY_ACTION_LIMIT
```

### 4. Redeploy with Environment Variables

```bash
vercel --prod
```

### 5. Update OAuth Callback URL

After deployment, update Supabase Google OAuth settings:
- Add production callback: `https://your-api.vercel.app/api/auth/callback`

## Testing

### 1. Test OAuth Flow

```bash
curl https://your-api.vercel.app/api/auth/google
```

Should return:
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### 2. Test AI Generation (requires auth token)

First, complete OAuth flow to get access token, then:

```bash
curl -X POST https://your-api.vercel.app/api/ai/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test prompt",
    "taskType": "default"
  }'
```

### 3. Test Usage Status

```bash
curl https://your-api.vercel.app/api/usage/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Should return:
```json
{
  "used": 1,
  "remaining": 14,
  "limit": 15,
  "resetsAt": "2026-02-09T00:00:00.000Z"
}
```

## Chrome Extension Integration

Update extension's API base URL to:
```javascript
const API_BASE_URL = 'https://your-api.vercel.app';
```

## Monitoring

- [ ] Check Vercel logs for errors
- [ ] Monitor Supabase usage table
- [ ] Check OpenRouter/Groq API usage
- [ ] Set up Vercel alerts for errors

## Security Checklist

- [ ] Service role key is set as environment variable (not in code)
- [ ] CORS headers are configured
- [ ] Rate limiting is working
- [ ] JWT verification is working
- [ ] OAuth redirect URLs are whitelisted

## Production Checklist

- [ ] All environment variables set
- [ ] Database table created with indexes
- [ ] OAuth configured and tested
- [ ] API endpoints tested
- [ ] Extension updated with production URL
- [ ] Monitoring set up
- [ ] Error handling tested

## Troubleshooting

### "Invalid or expired token"
- Check that access token is being sent correctly
- Verify Supabase credentials are correct
- Check token hasn't expired (refresh if needed)

### "Daily action limit exceeded"
- Check usage table in Supabase
- Verify DAILY_ACTION_LIMIT env var
- Check UTC timezone calculations

### "AI generation failed"
- Check OpenRouter/Groq API keys
- Verify API credits/quotas
- Check Vercel function logs

### CORS errors
- Verify vercel.json has correct headers
- Check that extension origin is allowed
- Test with browser dev tools

## Next Steps

After successful deployment:
1. Update extension with production API URL
2. Test full user flow (login → generate → check usage)
3. Monitor for errors
4. Set up analytics (optional)
5. Configure custom domain (optional)
