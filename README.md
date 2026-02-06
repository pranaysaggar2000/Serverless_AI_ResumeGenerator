# 🚀 AI Resume Generator & Tailor

An AI-powered Chrome Extension that generates ATS-optimized resumes tailored to specific job descriptions. **Fully serverless and client-side**—no backend deployment required!

## ✨ Key Features

### 🆕 New Capabilities
- **🗂️ Multi-Profile Management**: Create and switch between multiple base profiles (e.g., "Full Stack Dev", "Product Lead") to target different roles effectively.
- **🔄 Section Reordering**: Drag and drop resume sections (Education, Experience, Skills) to customize the layout.
- **⚡ Instant Base Resume**: Generate a professional, formatted PDF of your current profile without any AI tailoring—perfect for general applications.

### 🧠 Core Intelligence
- **🎯 ATS Optimization**: Automatically analyzes job descriptions (JD) and tailors your resume content to match key requirements.
- **📊 ATS Scoring & Analysis**: Get a detailed match score (0-100), missing keyword report, and actionable feedback.
- **💡 Smart Q&A**: Ask context-aware questions about the JD (e.g., "Do I meet the Python requirements?") and get answers based on your resume.

### 🛠️ Advanced Tools
- **✏️ Manual Editor**: Full control to edit the generated resume before downloading.
  - Add/Remove bullet points
  - Edit contact details & links
  - **Live Preview** of changes
- **📋 Granular Copy**: One-click copy for tailored summaries or experience blocks to paste into application forms.
- **📄 Professional PDF**: Generates clean, ATS-friendly PDFs directly in your browser.

## 🤖 AI Models & Cost

This tool is **100% Free** to operate using provider free tiers:

- **Google Gemini**: Uses `Gemini 2.0 Flash` (Free)
- **Groq**: Uses `Llama 3.3 70B` (Free)
- **⚠️ Nvidia NIM**: *Currently failing/unstable* due to API structure changes. Usage is not recommended.

## 🛠️ Prerequisites

- **Google Chrome** (to load the extension)
- **API Key** (Get for free):
  - [Google Gemini API Key](https://ai.google.dev/)
  - [Groq API Key](https://console.groq.com/)

## 📦 Installation (Local Load)

Since this is a client-side extension, you only need to load it into Chrome.

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   ```
2. **Load into Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (top right switch)
   - Click **Load unpacked** (top left)
   - Select the `chrome_extension` folder from this repository

That's it! The extension is now ready to use.

## 🚀 Usage Guide

### Step 1: Initial Setup
1. Click the extension icon.
2. Go to **Settings** (⚙️) and enter your Gemini or Groq API Key.
3. Switch back to the **Setup** tab.
4. Upload your current Resume PDF. The extension will extract your details locally.

### Step 2: Tailor a Resume
1. Navigate to any job posting (LinkedIn, Indeed, etc.).
2. Open the extension.
3. Click **"Process Page & Generate Resume"**.
4. The AI will analyze the job and your active profile to generate a tailored version using your local API key.

### Step 3: Refine & Download
1. Use the **Edit** button to tweak text or reorder sections.
2. Check the **ATS Score** tab for improvements.
3. Click **Download PDF** to get your application-ready resume generated instantly in the browser.

## 📂 Project Structure

```
├── chrome_extension/     # CORE: The complete extension
│   ├── modules/          # Logic (PDF gen, AI calls, state)
│   ├── lib/              # Dependencies (pdf.js, jspdf)
│   ├── popup.html        # UI Structure
│   └── manifest.json     # Configuration
└── README.md             # Documentation
```

*(Note: Legacy backend files `api/`, `main.py` may exist in the repo but are not used by the extension)*

## 🔒 Privacy & Permissions

- **Local Storage**: Your API keys and Resume Profiles are stored **locally** in your browser. They are never sent to to us or any third-party server.
- **Direct AI Calls**: The extension talks directly to Google/Groq APIs using your key. No middleman server.
- **Web Access**: The extension requires permission to read the current tab to extract Job Descriptions, but only runs when you explicitly click the button.

## 📝 License

MIT License.
