# ForgeCV API

Serverless backend for ForgeCV Chrome Extension - AI-powered resume tailoring with free tier support.

## Architecture

- **Platform**: Vercel Serverless Functions (Node.js)
- **Auth**: Supabase (Google OAuth)
- **Database**: Supabase (usage tracking)
- **AI Providers**: OpenRouter (primary) + Groq (fallback)

## Features

- 🔐 **Google OAuth** via Supabase
- 📊 **Usage Tracking** - 15 free AI actions/day per user
- 🤖 **AI Proxy** - Server-side API key management
- 🔄 **Smart Fallbacks** - Multiple AI models with automatic failover
- 🚀 **CORS Support** - Chrome extension compatible

## Project Structure

```
/api/
├── api/                    # Vercel serverless functions
│   ├── ai/
│   │   └── generate.js    # POST /api/ai/generate - AI proxy
│   ├── usage/
│   │   └── status.js      # GET /api/usage/status - Usage stats
│   └── auth/
│       ├── google.js      # GET /api/auth/google - OAuth init
│       └── callback.js    # GET /api/auth/callback - OAuth callback
├── lib/                    # Shared utilities
│   ├── supabase.js        # Supabase clients
│   ├── auth.js            # JWT verification
│   ├── rate-limit.js      # Usage tracking & limits
│   └── ai-providers.js    # OpenRouter + Groq logic
├── vercel.json            # Vercel config + CORS
├── package.json
└── .env.example
```

## Setup

### 1. Install Dependencies

```bash
cd api
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Supabase (get from https://app.supabase.com)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# AI Providers
OPENROUTER_API_KEY=sk-or-v1-...
GROQ_API_KEY=gsk_...

# Rate Limit (optional, defaults to 15)
DAILY_ACTION_LIMIT=15
```

### 3. Set Up Supabase Database

Create a `usage` table in Supabase:

```sql
CREATE TABLE public.usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast daily queries
CREATE INDEX idx_usage_user_date ON public.usage(user_id, created_at);
CREATE INDEX idx_usage_action_id ON public.usage(user_id, action_id);

-- Enable RLS (optional, we use service role)
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
```

### 4. Configure Supabase OAuth

In Supabase Dashboard → Authentication → Providers:
- Enable Google provider
- Add your Google OAuth credentials
- Set redirect URL: `https://your-api.vercel.app/api/auth/callback`

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# or use: vercel env add
```

## API Endpoints

### `POST /api/ai/generate`

Generate AI content with rate limiting.

**Headers:**
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "prompt": "Analyze this job description...",
  "taskType": "jdParse",  // or "tailor", "score", "default"
  "expectJson": true
}
```

**Response:**
```json
{
  "result": "AI generated content...",
  "usage": {
    "remaining": 14,
    "limit": 15
  }
}
```

**Errors:**
- `401` - Unauthorized (invalid token)
- `429` - Rate limit exceeded
- `500` - AI generation failed

---

### `GET /api/usage/status`

Check remaining daily actions.

**Headers:**
```
Authorization: Bearer <supabase_access_token>
```

**Response:**
```json
{
  "used": 1,
  "remaining": 14,
  "limit": 15,
  "resetsAt": "2026-02-09T00:00:00.000Z"
}
```

---

### `GET /api/auth/google`

Initiate Google OAuth flow.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

Extension should open this URL in a new tab.

---

### `GET /api/auth/callback`

OAuth callback (handled automatically by Supabase).

Returns HTML page that:
1. Shows success message
2. Posts tokens to extension via `postMessage`
3. Auto-closes after 2 seconds

## AI Provider Logic

### Model Chains

Different task types use optimized model chains:

- **jdParse**: `llama-3.3-70b → step-3.5-flash → openrouter/free`
- **tailor**: `llama-3.3-70b → gpt-oss-120b → openrouter/free`
- **score**: `llama-3.3-70b → step-3.5-flash → openrouter/free`
- **default**: `llama-3.3-70b → openrouter/free`

### Fallback Strategy

1. Try OpenRouter with model chain
2. On 429 (rate limit), skip to next model
3. On auth error, fail immediately
4. If all OpenRouter models fail, try Groq
5. Groq uses: `llama-3.3-70b-versatile → llama-3.1-8b-instant`

### Timeouts

- Per model: 30s
- Total request: 90s

## Development

```bash
# Local development
npm run dev

# Test endpoints
curl http://localhost:3000/api/usage/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Security Notes

- ✅ All AI API keys stored server-side
- ✅ JWT verification on every request
- ✅ Rate limiting per user
- ✅ CORS configured for Chrome extensions
- ✅ Service role key for admin operations

## Extension Integration

The Chrome extension should:

1. **Login**: Call `/api/auth/google`, open URL in new tab
2. **Listen**: Handle `FORGECV_AUTH_SUCCESS` postMessage
3. **Store**: Save `accessToken` and `refreshToken` in `chrome.storage.local`
4. **Use**: Send `Authorization: Bearer <accessToken>` with all requests
5. **Refresh**: Implement token refresh logic (Supabase handles this)

## License

Part of ForgeCV project.
