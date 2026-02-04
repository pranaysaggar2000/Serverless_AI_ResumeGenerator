# 🚀 AI Resume Generator & Tailor

An advanced, AI-powered tool that generates ATS-optimized resumes tailored to specific job descriptions. It features a Streamlit web app for manual use and a Chrome Extension for seamless integration with job boards.

## ✨ Key Features

-   **🎯 ATS Optimization**: Automatically tailors your resume keywords, summary, and bullet points to match the Job Description (JD) using advanced AI analysis.
-   **✏️ Advanced Manual Editor**: Full-featured form-based editor in the Chrome Extension.
    -   **Dynamic Editing**: Add/Remove Skill Categories, Experience Items, and Bullet Points.
    -   **Auto-Save**: Never lose your progress; changes persist between tab switches.
    -   **Contact Management**: Edit Location, Links, and contact details easily.
    -   **Live Regeneration**: Update the PDF instantly with your manual edits.
-   **📋 One-Click Copy**: Easily copy tailored experience and project descriptions to your clipboard for pasting into job application portals (e.g., Workday).
-   **📊 ATS Analysis & Scoring**: Get a detailed match score (0-100) and specific feedback using Gemini 1.5 Pro.
    -   Identifies missing keywords.
    -   Highlights strong matching areas.
    -   Provides actionable recommendations.
-   **💡 Smart Q&A**: Ask questions about the job description in the context of your resume (e.g., "Do I have the required Python experience?").
-   **🤖 Multi-Model Support**:
    -   **Primary**: Google Gemini 1.5 Flash / 2.0 Flash level.
    -   **Fallback**: Gemma 2 27B.
    -   **Groq**: Ultra-fast inference with Llama 3.
    -   **Ollama**: Local model support.
-   **📄 PDF Parsing with Link Extraction**: Extracts text and hidden hyperlinks (LinkedIn/Portfolio) from your existing PDF resume.
-   **🎨 Professional Layout**: Generates clean, polished PDFs using ReportLab with:
    -   Smart spacing adjustments (1pt precision).
    -   Overflow handling (smart trimming of optional bullets/projects).
    -   Clickable hyperlinks.
-   **🧩 Chrome Side Panel**: The tool attempts to open in the Side Panel, allowing it to stay open ("persist") while you browse and interact with different job postings.
    -   Tailor, Edit, and Analyze your resume directly alongside the job post.
-   **💾 Persistence**: Saves your base profile (`user_profile.json`) so you don't need to re-upload every time.

## 🛠️ Prerequisites

-   Python 3.10+
-   API Keys for at least one provider (Google Gemini Recommended)

## 📦 Installation

1.  **Clone the repository** (or download the files).
2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

## ⚙️ Configuration

1.  **Create a `.env` file** in the project root.
2.  **Add your API keys**:
    ```env
    # Required for the default/best experience
    GEMINI_API_KEY=your_google_gemini_key

    # Optional: For ultra-fast inference
    GROQ_API_KEY=your_groq_key

    # Optional: For other models
    OPENROUTER_API_KEY=your_openrouter_key
    ```
3.  **Git Ignore**: `user_profile.json` and `.env` are automatically ignored to protect your data.

## 🚀 Usage

### Option 1: Web App (Streamlit)
Ideal for testing layout changes or manually pasting JDs.

1.  Run the app:
    ```bash
    streamlit run app.py
    ```
2.  Upload your existing PDF resume (first time only).
3.  Paste a Job Description.
4.  Click **Generate Tailored Resume**.

### Option 2: Chrome Extension (Recommended)
Tailor resumes directly while browsing job sites.

1.  **Start the Backend Server**:
    The extension needs a local server to handle the AI processing.
    ```bash
    python server.py
    ```
    *Keep this terminal window running.*

2.  **Load the Extension**:
    -   Open Chrome and go to `chrome://extensions/`.
    -   Enable **Developer mode** (top right).
    -   Click **Load unpacked**.
    -   Select the `chrome_extension` folder in this directory.

3.  **Use It**:
    -   Navigate to a job posting (e.g., LinkedIn, Greenhouse, Lever).
    -   Click the extension icon.
    -   **Setup (First Time)**: If you haven't uploaded a resume yet, you'll be prompted to upload your base PDF to create your profile.
    -   **Generate**: Click "Process Page & Generate Resume" to create an initial tailored version.
    -   **Edit**: Click "✏️ Edit Resume" to tweak content. You can add/remove bullets, jobs, or skills. Changes auto-save!
        -   Click "Save & Regenerate" to update the PDF.
    -   **Copy**: Click "📋 Copy Content" to open a list of your tailored experiences and projects. Click the copy button next to any item to grab the text for job application forms.
    -   **Analyze**: Click "📊 Analyze ATS Score" to see how well you match the JD and get improvement tips.
    -   **Ask**: Use the Smart Q&A box to prepare for interviews or clarify requirements.
    -   The final PDF is saved in `generated_resumes/` and can be downloaded or previewed.

## 📂 Project Structure

-   `main.py`: Core logic for AI interaction, PDF parsing, and content tailoring.
-   `resume_builder.py`: PDF generation engine using ReportLab. Handles layout, fonts, and drawing.
-   `app.py`: Streamlit frontend interface.
-   `server.py`: Flask backend API for the Chrome Extension.
-   `user_profile.json`: Stores your parsed resume data (name, experience, skills) locally.
-   `chrome_extension/`: Source code for the browser extension (manifest, popup, scripts).
-   `requirements.txt`: Python dependencies.

## ❓ Troubleshooting

-   **Missing LinkedIn/Portfolio Links**: Make sure to re-upload your resume if you haven't recently. We added a fix to extract hidden hyperlinks from PDFs.
-   **Summary too short?**: We recently adjusted the prompt. If it's still short, check the logs in `main.py` to see the AI response.
-   **API Errors**: Check your `.env` file and ensure your API quota isn't exceeded. The system tries to fallback to Gemma 2 if Gemini fails.

## 🔒 Data Privacy & Permissions

**Why does this extension request access to "all websites"?**
Because this tool uses the **Side Panel** to allow you to generate resumes while browsing *any* job board (LinkedIn, Indeed, Company Careers pages, etc.), it requires the `activeTab` or `<all_urls>` permission to read the job description from the page you are currently viewing.

-   **On-Demand Access**: The extension **ONLY** reads the content of a page when you explicitly click the **"Process Page & Generate Resume"** button.
-   **No Background Tracking**: It does not track your browsing history or read data from tabs you are not actively using for resume generation.
-   **Local Processing**: Your personal data (resume profile) stays on your machine (in `user_profile.json` and Chrome Local Storage). It is only sent to the AI provider (e.g., Google Gemini) for the specific purpose of generating the resume.
