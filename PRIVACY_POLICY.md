# Privacy Policy for ForgeCV

**Last Updated:** February 9, 2026

ForgeCV ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we handle your data when you use the ForgeCV Chrome Extension and our associated API services.

## 1. Data Collection and Usage

ForgeCV is designed with a "local-first" philosophy. We minimize data collection and prioritize local storage for your sensitive resume data.

### A. Personal Information (Resume Data)
- **What:** We process the personal information contained in the resumes you upload (Name, Email, Phone, Experience, etc.).
- **How:** This data is parsed and stored **locally** in your browser's storage (`chrome.storage.local`).
- **Processing (BYOK Mode):** If you use your own API keys, your resume data is sent directly from your browser to the AI provider (Google or Groq). It never touches our servers.
- **Processing (Free Mode):** If you use our Free tier, your resume data and job descriptions are sent to our secure Vercel API, which proxies the request to the AI provider using our project keys. We do not permanently store your resume content on our servers.

### B. User Accounts & Authentication
- **What:** If you sign in via Google, we store your email address, name, and a unique user ID using Supabase.
- **Why:** To manage your account, track your daily usage limits, and provide access to the Free tier service.

### C. Usage & Security Monitoring
- **Usage Tracking:** We track the number and type of AI actions (e.g., 'tailor', 'score') you perform daily to enforce rate limits.
- **Security Audits:** To prevent API abuse (such as non-resume related queries or prompt injection attacks), our server may log truncated previews of AI prompts. These logs are used strictly for security monitoring and are deleted periodically.

### D. Website Content (Job Descriptions)
- **What:** We read the text content of the job description web page you are currently viewing.
- **How:** This is done via the `activeTab` permission when you explicitly trigger a forge or analysis.
- **Sharing:** This text is processed using the same logic as your Resume Data (Direct in BYOK mode, Proxied in Free mode).

## 2. API Keys
- Any API keys you provide (e.g., Gemini API Key, Groq API Key) are stored **locally** in your browser.
- They are used strictly to authenticate direct requests between your browser and the AI providers. They are never sent to our servers.

## 3. Third-Party Services

We use the following third-party services to provide core functionality:

- **Google Gemini API**: AI generation. [Google Privacy Policy](https://policies.google.com/privacy)
- **Groq API**: AI generation. [Groq Privacy Policy](https://wow.groq.com/privacy-policy/)
- **OpenRouter**: AI generation. [OpenRouter Privacy](https://openrouter.ai/privacy)
- **Supabase**: Account management and usage database. [Supabase Privacy](https://supabase.com/privacy)
- **Vercel**: Hosting for our API proxy. [Vercel Privacy](https://vercel.com/privacy)

## 4. Data Security
- Your primary resume profile is stored locally on your device.
- All transmissions occur over secure, encrypted HTTPS connections.
- We do not sell, trade, or rent your personal identification information to third parties.

## 5. Contact Us
If you have questions about this Privacy Policy, please contact us at [forgecvcontact@gmail.com](mailto:forgecvcontact@gmail.com) or via the Chrome Web Store support page.
