# 🚀 AI Resume Generator & Tailor

An AI-powered Chrome Extension that generates ATS-optimized resumes tailored to specific job descriptions. Built with a serverless backend deployed on Vercel, supporting both Google Gemini and Groq AI providers.

## ✨ Key Features

- **🎯 ATS Optimization**: Automatically tailors your resume to match job descriptions using advanced AI analysis
- **✏️ Advanced Manual Editor**: Full-featured editor in the Chrome Extension
  - Dynamic editing: Add/remove skill categories, experience items, and bullet points
  - Auto-save: Changes persist between section switches
  - Contact management: Edit location, links, and contact details
  - Live regeneration: Update PDF instantly with manual edits
- **📋 Granular Copy**: Copy tailored summaries, experience descriptions, and project details individually to clipboard
- **📊 ATS Analysis & Scoring**: Get detailed match scores (0-100) with comprehensive feedback
  - Summary feedback on overall fit
  - Strong matching areas highlighted
  - Missing keywords identified
  - Actionable recommendations provided
- **💡 Smart Q&A**: Ask questions about the job description in the context of your resume
- **🤖 Dual AI Provider Support**:
  - **Google Gemini 2.5**: Flash for generation, Pro for analysis
  - **Groq**: Ultra-fast inference with Llama 3.3 70B, fallback chain to Llama 3.1 8B and Qwen 32B
- **📄 PDF Generation**: Professional, clean PDFs with clickable hyperlinks
- **☁️ Serverless Architecture**: Deployed on Vercel for zero-maintenance operation

## 🛠️ Prerequisites

- Python 3.10+ (for local development/deployment)
- API key for at least one provider:
  - [Google Gemini API](https://ai.google.dev/)
  - [Groq API](https://console.groq.com/)

## 📦 Installation & Deployment

### Backend Deployment (Vercel)

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd Serverless_AI_ResumeGenerator
   ```

2. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables** in Vercel Dashboard:
   - `GEMINI_API_KEY` (if using Gemini)
   - `GROQ_API_KEY` (if using Groq)

5. **Note your deployment URL** (e.g., `https://your-app.vercel.app`)

### Chrome Extension Setup

1. **Update API URL**:
   - Open `chrome_extension/popup.js`
   - Update `API_BASE_URL` to your Vercel deployment URL

2. **Load the Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `chrome_extension` folder

3. **Configure API Keys**:
   - Click the extension icon
   - Go to **Settings** (⚙️)
   - Select your preferred provider (Gemini or Groq)
   - Enter your API key
   - Save settings

## 🚀 Usage

### First-Time Setup

1. Click the extension icon on any page
2. Upload your base resume PDF
3. The extension will extract and store your profile

### Generating Tailored Resumes

1. Navigate to a job posting (LinkedIn, Indeed, company careers page, etc.)
2. Click the extension icon
3. Click **"Process Page & Generate Resume"**
4. Wait for the AI to analyze and tailor your resume
5. Preview or download the generated PDF

### Advanced Features

- **Edit Resume**: Click "✏️ Edit Resume" to manually refine content
  - Select sections (Summary, Skills, Experience, Projects, etc.)
  - Add/remove items and bullets
  - Click "Save & Regenerate" to update the PDF

- **Copy Content**: Click "📋 Copy Content" to access granular copy options
  - Copy individual summaries, experience descriptions, or project details
  - Perfect for filling out application forms

- **Analyze ATS Score**: Click "📊 Analyze ATS Score" for detailed feedback
  - View match score, missing keywords, and recommendations
  - Only runs when you click (not automatic)

- **Smart Q&A**: Ask questions in the Q&A box
  - Example: "Do I have the required Python experience?"
  - Get contextual answers based on your resume and the job description

## 📂 Project Structure

```
├── api/
│   └── index.py          # Vercel serverless API endpoints
├── chrome_extension/
│   ├── manifest.json     # Extension configuration
│   ├── popup.html        # Extension UI
│   └── popup.js          # Extension logic
├── main.py               # Core AI logic and resume tailoring
├── resume_builder.py     # PDF generation with ReportLab
├── requirements.txt      # Python dependencies
├── vercel.json          # Vercel deployment config
└── README.md
```

## 🔧 API Endpoints

- `POST /api/extract_text`: Extract text from uploaded PDF
- `POST /api/extract_base_profile`: Parse resume into structured data
- `POST /api/tailor_resume`: Generate tailored resume from JD
- `POST /api/generate_pdf`: Create PDF from resume data
- `POST /api/analyze`: Perform ATS analysis
- `GET /api/health`: Health check endpoint

## ❓ Troubleshooting

- **"Analysis Error: Invalid API Key"**: Check that you've entered the correct API key for your selected provider in Settings
- **"No Job Description detected"**: Refresh the page and try again, or manually paste the JD
- **Extension not loading**: Make sure you've updated the `API_BASE_URL` in `popup.js` to your Vercel deployment URL
- **PDF generation fails**: Check Vercel logs for errors; ensure your deployment has sufficient memory

## 🔒 Privacy & Permissions

**Why does this extension request access to "all websites"?**

The extension needs to read job descriptions from any job board you visit (LinkedIn, Indeed, company career pages, etc.).

- **On-Demand Only**: Content is read only when you click "Process Page & Generate Resume"
- **No Background Tracking**: Does not track browsing history or read tabs you're not actively using
- **Secure Processing**: Resume data is sent only to your chosen AI provider (Gemini/Groq) for generation
- **Local Storage**: Your base profile is stored in Chrome's local storage, not on any server

## 📝 License

MIT License - feel free to use and modify for your needs.

## 🙏 Acknowledgments

Built with:
- Google Gemini 2.5 / Groq APIs
- ReportLab for PDF generation
- Vercel for serverless hosting
- Chrome Extensions API
