

# ForgeCV Landing Page — "The Resume That Sells Itself"

## Concept
The entire landing page is designed to look like a beautifully formatted, ATS-perfect resume — sitting on a slightly textured desk/background. The page IS the product demo. It proves ForgeCV works by being a stunning resume itself.

## Visual Design
- **Page background**: Subtle warm gray or soft linen texture (the "desk")
- **Resume container**: A white, A4-ratio card with clean margins, centered on the page, with a subtle paper shadow
- **Typography**: Inter font, classic resume styling — name big and bold at top, section headers with a slate blue underline/divider
- **Color palette**: Slate Blue (#475569) for headings/lines, Black for body text, Green (#10B981) only for the download CTA button
- **Mobile**: The resume card goes full-width on small screens, maintaining the clean formatting

## Resume Sections (Top to Bottom)

### "Resume Header" (Name & Contact)
- **Name**: "ForgeCV" in large bold text, just like a resume name
- **Title line below**: "Senior Resume Optimizer | Chrome Extension | v1.0.0"
- **Contact line** (with icons, like a real resume): GitHub link • "Free & Open Source" • "Zero Backend"
- **Green CTA button** right here at the top: "Download for Chrome (v1.0.0)"
- Small trust text: "No data leaves your device. No backend server. Open Source."

### "Professional Summary"
- Classic resume summary paragraph style
- "A 100% free, privacy-first Chrome Extension that tailors your resume to any job description using AI. Runs entirely in your browser using your own Gemini or Groq API key. No subscriptions. No servers. No data collection."

### "Experience" (Features as Job Entries)
Each feature styled exactly like a resume experience entry:

**Smart Tailoring Engine** — ForgeCV Labs
*Sep 2025 – Present*
- Scans the Job Description on your current browser tab and rewrites resume bullets to match keywords
- Supports 3 strategies: Conservative (keep your voice), Balanced, and Aggressive (max ATS score)
- Restores immutable fields post-AI to ensure truthfulness — dates, titles, and facts stay yours

**Privacy & Security Architecture** — ForgeCV Labs
*Sep 2025 – Present*
- Operates 100% client-side with zero backend servers — no Vercel, no Heroku, nothing
- Resume data travels only from your browser directly to Google/Groq and back
- All state persisted locally via chrome.storage — we literally cannot see your data

**Advanced Resume Editor** — ForgeCV Labs
*Sep 2025 – Present*
- Full drag-and-drop UI to reorder sections, add/remove bullets, and perfect AI output
- Live PDF preview before downloading — pixel-perfect rendering via jsPDF
- Smart Q&A: Ask "Do I have enough Python experience for this role?" and get a contextual answer

### "The Problem I Solve" (styled as a brief "Why I'm the Right Fit" blurb)
Three short bullet points in a slightly highlighted area:
- **The Black Box**: You apply to 100 jobs and hear nothing — an algorithm rejected you before a human ever saw your resume
- **The Privacy Risk**: Most AI resume tools upload your personal data to unknown servers
- **The Cost**: Competitors charge $20+/month just to rewrite a few bullet points

### "Skills" (Tech Stack)
Displayed as a classic resume skills grid:
- **AI Providers**: Google Gemini 2.0 Flash, Groq Llama 3.3
- **Platform**: Chrome Extension (Manifest V3)
- **PDF Engine**: pdf.js (input), jsPDF (output)
- **Architecture**: Serverless, Client-Side, ES6 Modules

### "Education" (Installation Guide)
Styled like education entries but contains the 4 installation steps. Uses a slightly different background (subtle dark/terminal feel within the resume aesthetic) to make it stand out:

**Chrome Extension Installation** — Self-Paced
*Step 1*: Download the ZIP file and unzip it to a folder
*Step 2*: Open Chrome → navigate to chrome://extensions
*Step 3*: Toggle "Developer Mode" ON (top-right corner)
*Step 4*: Click "Load Unpacked" → select the unzipped folder

### "References" (Footer)
- "Built by Pranay Saggar"
- LinkedIn and GitHub icon links
- Copyright line
- A final small green CTA: "Download ForgeCV"

## Why This Works
- **It's meta**: The landing page proves the product works by being a perfect resume itself
- **Instant comprehension**: Every user knows how to read a resume — zero learning curve for the page layout
- **Trust signal**: If the tool's own landing page looks this clean and organized, users trust it to make their resume look great too
- **Memorable**: Nobody else has a landing page that looks like a resume — it's inherently shareable and remarkable

