# 🚶 Walkthrough Guide: Changelog & Features

This document tracks the evolution of the ForgeCV codebase, highlighting new features, architectural changes, and known issues.

## 🌟 New Features Added

### 1. 🗂️ Multi-Profile Management
- **Description**: Users can now create and switch between multiple resume profiles (e.g., "Software Engineer", "Product Manager").
- **Implementation**: Utilizes `chrome.storage.local` to store a dictionary of profiles.
- **UI**: Added a profile management interface in the popup to create, switch, and delete profiles.

### 2. 🔄 Section Reordering
- **Description**: Drag-and-drop interface to rearrange resume sections.
- **Implementation**: Persists section order in the resume object, which is respected during PDF generation.
- **UI**: New "Reorder Sections" button and modal in the manual editor.

### 3. ⚡ Base Resume Generation (No AI)
- **Description**: Generate a clean, formatted PDF version of the uploaded resume *without* AI tailoring.
- **Use Case**: Useful for users who just want a nice PDF of their existing data.
- **UI**: "Generate Base Resume" button in the main dashboard.

### 4. 🧠 Expanded AI Models
- **Gemini 2.5**: Updated prompt structure for better results.
- **Groq Llama 3.3**: Fast inference support.
- **Note**: Both providers offer free tiers, making the tool zero-cost to run.

### 5. 🛠️ Advanced Manual Editor Enhancements
- **Dynamic Bullet Points**: Add/remove bullets easily.
- **Profile Data Editing**: Edit contact info and links directly within the extension.
- **Preview**: "Instant Preview" button to see changes before finalizing.

## ⚠️ Known Issues / Deprecations

### 1. Nvidia NIM API
- **Status**: **Failing / Unstable**.
- **Reason**: The Nvidia API structure has changed, causing the current integration to fail during the tailoring request.
- **Action**: Users are advised to use Gemini or Groq until a fix is deployed.

### 2. Removed / Refactored
- **Backend Dependency (Vercel)**: The extension is now fully **client-side**.
  - **Removed**: Requirement to deploy a Python backend on Vercel.
  - **Changed**: PDF text extraction now uses `pdf.js` in the browser.
  - **Changed**: PDF generation now uses `jspdf` in the browser.
  - **Status**: The `api/` folder and `main.py` are legacy artifacts and are no longer required for the extension to function.
- **Single Profile Limitation**: The previous restriction of holding only one "base resume" has been removed.

## 📂 Codebase Overview (Current State)

- **`chrome_extension/`**: Contains the core logic (popup, state management, API calls, PDF generation).
- **`api/`**: Serverless functions for Vercel (PDF parsing, etc.).
- **`main.py`**: Legacy/Backend core logic.
- **`privacy.html` / `privacy_policy.md`**: Updated data protection guidelines.
