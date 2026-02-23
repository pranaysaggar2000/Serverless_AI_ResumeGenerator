import { Github, Linkedin, Download, Shield, Sparkles, GripVertical, Globe, Lock, DollarSign, Terminal, ExternalLink, ChevronDown, Chrome, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const DOWNLOAD_URL = "https://github.com/pranaysaggar2000/Serverless_AI_ResumeGenerator/releases/latest/download/ForgeCVextension.zip";
const GITHUB_URL = "https://github.com/pranaysaggar2000/Serverless_AI_ResumeGenerator";
const LINKEDIN_URL = "https://linkedin.com/in/pranay-saggar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:py-16">
      {/* The Resume "Paper" */}
      <article className="mx-auto max-w-[850px] bg-card shadow-[0_4px_40px_rgba(0,0,0,0.12)] rounded-sm">
        <div className="px-8 py-10 sm:px-14 sm:py-14">

          {/* ===== HEADER ===== */}
          <header>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-primary">
                  ForgeCV
                </h1>
                <p className="mt-1 text-sm sm:text-base font-medium text-muted-foreground">
                  Senior Resume Optimizer &nbsp;|&nbsp; Chrome Extension &nbsp;|&nbsp; v1.1.3
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold border border-border rounded px-2 py-1 text-muted-foreground">
                  v1.1.3
                </span>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-accent transition-colors"
                  aria-label="GitHub"
                >
                  <Github size={20} />
                </a>
              </div>
            </div>

            {/* Contact line */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Globe size={12} /> Free &amp; Open Source</span>
              <span className="flex items-center gap-1"><Lock size={12} /> Zero Backend</span>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                <Github size={12} /> GitHub
              </a>
            </div>

            {/* CTA */}
            <div className="mt-6">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 text-base font-bold px-8 rounded-md shadow-md w-full sm:w-auto"
                >
                  <a href={DOWNLOAD_URL}>
                    <Download size={18} className="mr-2" />
                    Download .zip (v1.1.3)
                  </a>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-base font-bold px-8 rounded-md shadow-sm w-full sm:w-auto border-2 hover:bg-muted/50"
                >
                  <a
                    href="https://chromewebstore.google.com/detail/ncfipelmdjkgobmcdcobdjgbkjnblahg?utm_source=item-share-cb"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Chrome size={18} className="mr-2" />
                    Available on Chrome Store
                  </a>
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                No data leaves your device. No backend server. Open Source.
              </p>
            </div>
          </header>

          <SectionDivider />

          {/* ===== PROFESSIONAL SUMMARY ===== */}
          <ResumeSection title="Professional Summary">
            <p className="text-sm leading-relaxed text-card-foreground">
              A powerful, privacy-first Chrome Extension that tailors your resume to any job
              description using AI. <strong>New: Login with Google for 15 free generations daily.</strong> Supports both
              <strong> Bring Your Own Key (BYOK)</strong> (Gemini, Groq, OpenRouter) for 100% client-side privacy and a managed serverless mode
              for convenience. No subscriptions. No hidden data collection.
            </p>
          </ResumeSection>

          <SectionDivider />

          {/* ===== EXPERIENCE ===== */}
          <ResumeSection title="Experience">
            <ExperienceEntry
              role="Smart Tailoring Engine"
              company="ForgeCV Labs"
              date="Feb 2026 – Present"
              icon={<Sparkles size={16} className="text-accent" />}
              bullets={[
                "Scans the Job Description on your current browser tab and rewrites resume bullets to match keywords",
                "Supports 3 strategies: Conservative (keep your voice), Balanced, and Aggressive (max ATS score)",
                "Restores immutable fields post-AI to ensure truthfulness — dates, titles, and facts stay yours",
              ]}
            />
            <ExperienceEntry
              role="Privacy & Security Architecture"
              company="ForgeCV Labs"
              date="Feb 2026 – Present"
              icon={<Shield size={16} className="text-accent" />}
              bullets={[
                "Hybrid Architecture: Choose between zero-setup Google Login (Serverless) or full privacy BYOK (Client-side)",
                "Generous Free Tier: 15 free AI generations per day with secure Google authentication",
                "Zero Data Retention: We never store your personal data. All state is persisted locally via chrome.storage",
              ]}
            />
            <ExperienceEntry
              role="Advanced Resume Editor"
              company="ForgeCV Labs"
              date="Feb 2026 – Present"
              icon={<GripVertical size={16} className="text-accent" />}
              bullets={[
                "Full drag-and-drop UI to reorder sections, add/remove bullets, and perfect AI output",
                "Live PDF preview before downloading — pixel-perfect rendering via jsPDF",
                'Smart Q&A: Ask "Do I have enough Python experience for this role?" and get a contextual answer',
              ]}
            />
          </ResumeSection>

          <SectionDivider />

          {/* ===== THE PROBLEM I SOLVE ===== */}
          <ResumeSection title="Why I'm the Right Fit">
            <div className="bg-muted/60 rounded-md p-4 sm:p-6 space-y-3">
              <ProblemBullet
                icon={<Lock size={14} />}
                label="The Black Box"
                text="You apply to 100 jobs and hear nothing — an algorithm rejected your resume before a human ever saw it."
              />
              <ProblemBullet
                icon={<Shield size={14} />}
                label="The Privacy Risk"
                text="Most AI resume tools upload your personal data to unknown servers."
              />
              <ProblemBullet
                icon={<DollarSign size={14} />}
                label="The Cost"
                text="Competitors charge $20+/month. ForgeCV gives you 15 free generations every day, forever."
              />
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== SCREENSHOTS (Carousel) ===== */}
          <ResumeSection title="Screenshots">
            <div className="mx-auto w-full px-4 sm:px-0">
              <Carousel className="w-full" opts={{ align: "start" }}>
                <CarouselContent>
                  <CarouselSlide src="/screenshots/API_Key_EditUI.png" caption="Secure Authentication: Google Login or BYOK (Gemini, Groq, OpenRouter)." />
                  <CarouselSlide src="/screenshots/ProfileUI.png" caption="Create and manage your base resume profile." />
                  <CarouselSlide src="/screenshots/Initial_Main_UI.png" caption="Clean, distraction-free interface." />
                  <CarouselSlide src="/screenshots/Main_Page_UI.png" caption="One-click tailoring from any job description." />
                  <CarouselSlide src="/screenshots/Format_Edit_UI.png" caption="Customize formatting options." />
                  <CarouselSlide src="/screenshots/Content_Edit_UI.png" caption="Advanced manual editor with real-time preview." />
                  <CarouselSlide src="/screenshots/Change_Order_UI.png" caption="Drag & Drop section reordering." />
                  <CarouselSlide src="/screenshots/Profile_UpdateUI.png" caption="Manage multiple profiles for different roles." />
                  <CarouselSlide src="/screenshots/Copy_ContentUI.png" caption="Copy tailored content to clipboard instantly." />
                  <CarouselSlide src="/screenshots/ATS_UI.png" caption="Detailed ATS scoring and keyword gap analysis." />
                  <CarouselSlide src="/screenshots/Question_Helper_UI.png" caption="Ask context-aware questions about the job." />
                </CarouselContent>
                <CarouselPrevious className="-left-4 sm:-left-12" />
                <CarouselNext className="-right-4 sm:-right-12" />
              </Carousel>
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== SKILLS ===== */}
          <ResumeSection title="Skills">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <SkillRow label="AI Providers" value="Google Gemini, Groq, OpenRouter" />
              <SkillRow label="Platform" value="Chrome Extension (Manifest V3)" />
              <SkillRow label="PDF Engine" value="pdf.js (input), jsPDF (output)" />
              <SkillRow label="Architecture" value="Hybrid (Client/Server), Google Auth, ES6 Modules" />
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== COMING SOON ===== */}
          <ResumeSection title="Coming Soon">
            <div className="bg-muted/30 border border-border/50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-500">
              <div className="p-6 sm:p-10 flex flex-col lg:flex-row gap-10 items-center">
                <div className="flex-1 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20">
                    <Rocket size={14} />
                    In Development
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Split-Screen Real-Time Editor</h3>
                  <p className="text-muted-foreground leading-relaxed text-base">
                    This is what you've been waiting for. We're building a powerful <strong>split-screen interface</strong> that lets you see your resume changes in real-time.
                  </p>
                  <ul className="space-y-2 text-sm text-card-foreground/90">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Live PDF preview as you type
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Drag & Drop sections instantly
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Pixel-perfect precision control
                    </li>
                  </ul>
                  <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    <span>Released in v1.1.3</span>
                  </div>
                </div>
                <div className="flex-1 w-full max-w-md lg:max-w-lg">
                  <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border/50 bg-background group ring-1 ring-border/50">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <img
                      src="/screenshots/upcoming_screenshot.jpeg"
                      alt="Preview of the upcoming split-screen editor interface"
                      className="w-full h-auto object-cover transform group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-3 italic">
                    Sneak peek of the upcoming UI (Work in Progress)
                  </p>
                </div>
              </div>
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== EDUCATION (Installation) ===== */}
          <ResumeSection title="Education">
            {/* Chrome Extension Installation */}
            <div className="bg-foreground/[0.04] dark:bg-foreground/10 border border-border rounded-md overflow-hidden mb-6">
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 mb-1">
                  <Terminal size={16} className="text-accent" />
                  <h4 className="font-bold text-sm text-card-foreground">Chrome Extension Installation</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Self-Paced &nbsp;·&nbsp; ~2 minutes</p>
                <ol className="space-y-2 text-sm text-card-foreground">
                  <InstallStep n={1}>Download the ZIP file above.</InstallStep>
                  <InstallStep n={2}>
                    <strong>Extract the ZIP file</strong> to a folder on your computer (e.g., Downloads/ForgeCV).
                  </InstallStep>
                  <InstallStep n={3}>
                    Open Chrome → navigate to{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">chrome://extensions</code>
                  </InstallStep>
                  <InstallStep n={4}>Toggle <strong>"Developer Mode"</strong> ON (top-right corner).</InstallStep>
                  <InstallStep n={5}>
                    Click <strong>"Load Unpacked"</strong> → select the <strong>extracted folder</strong> (not the ZIP file).
                  </InstallStep>
                </ol>
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-accent hover:text-accent/80 font-semibold flex items-center gap-1">
                    <ChevronDown size={14} className="inline" />
                    Click for detailed step-by-step guide
                  </summary>
                  <div className="mt-3 space-y-3 pl-5 text-muted-foreground leading-relaxed">
                    <div>
                      <strong className="text-card-foreground">Step 1:</strong> Click the "Download for Chrome" button at the top of this page. Your browser will download a file called <code className="bg-muted px-1 py-0.5 rounded">ForgeCVextension.zip</code>.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 2:</strong> Locate the downloaded ZIP file (usually in your Downloads folder). Right-click it and select "Extract All" (Windows) or double-click it (Mac) to extract the contents. Remember the folder location.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 3:</strong> Open Google Chrome. In the address bar, type <code className="bg-muted px-1 py-0.5 rounded">chrome://extensions</code> and press Enter. This opens the Extensions management page.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 4:</strong> On the Extensions page, look for a toggle switch labeled "Developer mode" in the top-right corner. Click it to turn it ON (it should turn blue).
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 5:</strong> After enabling Developer mode, you'll see new buttons appear. Click the "Load unpacked" button. A file browser will open. Navigate to the folder you extracted in Step 2 and select it. Click "Select Folder" (or "Open" on Mac).
                    </div>
                    <div>
                      <strong className="text-card-foreground">Done!</strong> ForgeCV should now appear in your extensions list. You can pin it to your toolbar by clicking the puzzle piece icon in Chrome and clicking the pin next to ForgeCV.
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Update Instructions */}
            <div className="bg-foreground/[0.04] dark:bg-foreground/10 border border-border rounded-md overflow-hidden mb-6">
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 mb-1">
                  <Download size={16} className="text-accent" />
                  <h4 className="font-bold text-sm text-card-foreground">How to Update ForgeCV</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">When a new version is released &nbsp;·&nbsp; ~1 minute</p>

                <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                  <p className="text-xs text-green-900 dark:text-green-200">
                    <strong>✅ Recommended:</strong> Use Method 1 to keep all your API keys and profiles intact!
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-2 border-green-500/30 rounded-md p-4 bg-green-50/50 dark:bg-green-900/10">
                    <h5 className="font-semibold text-sm text-card-foreground mb-2">
                      Method 1: Replace in Same Folder (Recommended ⭐)
                    </h5>
                    <ol className="space-y-2 text-sm text-card-foreground">
                      <InstallStep n={1}>Download the latest version.</InstallStep>
                      <InstallStep n={2}>
                        Extract it and <strong>replace the contents</strong> of your existing ForgeCV folder.
                      </InstallStep>
                      <InstallStep n={3}>
                        Go to <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">chrome://extensions</code>
                      </InstallStep>
                      <InstallStep n={4}>
                        Click the <strong>reload icon</strong> (🔄) on the ForgeCV card. Done!
                      </InstallStep>
                    </ol>
                    <div className="mt-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded p-2">
                      <p className="text-xs text-green-900 dark:text-green-200">
                        ✅ Keeps all API keys and profiles automatically
                      </p>
                    </div>
                  </div>

                  <div className="border border-border rounded-md p-4 bg-background/50">
                    <h5 className="font-semibold text-sm text-card-foreground mb-2">Method 2: New Folder (Not Recommended)</h5>
                    <ol className="space-y-2 text-sm text-card-foreground">
                      <InstallStep n={1}>Download the latest version.</InstallStep>
                      <InstallStep n={2}>
                        Extract to a <strong>new/different folder</strong> (e.g., Downloads/ForgeCV_v2).
                      </InstallStep>
                      <InstallStep n={3}>
                        Go to <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">chrome://extensions</code>
                      </InstallStep>
                      <InstallStep n={4}>
                        Click <strong>"Remove"</strong> on the old ForgeCV extension.
                      </InstallStep>
                      <InstallStep n={5}>
                        Click <strong>"Load unpacked"</strong> and select the new folder. Done!
                      </InstallStep>
                    </ol>
                    <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded p-2">
                      <p className="text-xs text-amber-900 dark:text-amber-200">
                        ⚠️ May require re-entering API keys and profiles
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>💡 Tip:</strong> Method 1 preserves all your data automatically. Method 2 may require re-entering settings.
                  </p>
                </div>
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-accent hover:text-accent/80 font-semibold flex items-center gap-1">
                    <ChevronDown size={14} className="inline" />
                    Click for detailed update guide
                  </summary>
                  <div className="mt-3 space-y-3 pl-5 text-muted-foreground leading-relaxed">
                    <div>
                      <strong className="text-card-foreground">Method 1: Quick Reload (Recommended)</strong>
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 1:</strong> Download the latest version from this page. You'll get a new <code className="bg-muted px-1 py-0.5 rounded">ForgeCVextension.zip</code> file.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 2:</strong> Extract it to a new folder (don't overwrite the old one yet). This gives you a backup in case something goes wrong.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 3:</strong> Open Chrome and go to <code className="bg-muted px-1 py-0.5 rounded">chrome://extensions</code>. Find the ForgeCV extension card.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 4:</strong> Look for a circular refresh/reload icon (🔄) on the ForgeCV card. Click it. Chrome will reload the extension from the same folder.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 5:</strong> If you extracted to a different folder, you'll need to use Method 2 below.
                    </div>
                    <div className="mt-4">
                      <strong className="text-card-foreground">Method 2: Remove and Reinstall</strong>
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 1:</strong> On <code className="bg-muted px-1 py-0.5 rounded">chrome://extensions</code>, click "Remove" on the old ForgeCV extension. Don't worry — your data is safe!
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 2:</strong> Click "Load unpacked" and select the new extracted folder.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 3:</strong> Your settings, API keys, and saved profiles will automatically restore because they're stored in Chrome's local storage, not in the extension folder.
                    </div>
                    <div className="mt-4">
                      <strong className="text-card-foreground">What gets preserved:</strong> ✅ API keys, ✅ Saved profiles, ✅ Settings, ✅ Format preferences
                    </div>
                    <div>
                      <strong className="text-card-foreground">What gets reset:</strong> ❌ Current session data (just regenerate your resume)
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Google Login Option */}
            <div className="bg-foreground/[0.04] dark:bg-foreground/10 border border-border rounded-md overflow-hidden mb-6">
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-accent" />
                  <h4 className="font-bold text-sm text-card-foreground">Option 1: Google Login (Easiest)</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Instant Access &nbsp;·&nbsp; 15 Free Daily Generations</p>
                <ol className="space-y-2 text-sm text-card-foreground">
                  <InstallStep n={1}>Open the extension.</InstallStep>
                  <InstallStep n={2}>Click <strong>"Sign in with Google"</strong>.</InstallStep>
                  <InstallStep n={3}>Enjoy <strong>15 free generations</strong> every single day.</InstallStep>
                </ol>
              </div>
            </div>

            {/* API Key Setup - Groq */}
            <div className="bg-foreground/[0.04] dark:bg-foreground/10 border border-border rounded-md overflow-hidden mb-6">
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-accent" />
                  <h4 className="font-bold text-sm text-card-foreground">Option 2: Get Free Groq API Key (Unlimited)</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Free Tier &nbsp;·&nbsp; Fast &nbsp;·&nbsp; ~1 minute</p>
                <ol className="space-y-2 text-sm text-card-foreground">
                  <InstallStep n={1}>
                    Visit{" "}
                    <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                      console.groq.com
                      <ExternalLink size={12} />
                    </a>
                  </InstallStep>
                  <InstallStep n={2}>
                    <strong>Sign up using Google or GitHub</strong> (recommended — email login can be unreliable).
                  </InstallStep>
                  <InstallStep n={3}>
                    After signing in, click <strong>"API Keys"</strong> in the left sidebar.
                  </InstallStep>
                  <InstallStep n={4}>
                    Click <strong>"Create API Key"</strong> → copy the key → paste it into ForgeCV settings.
                  </InstallStep>
                </ol>
                <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    <strong>⚠️ Important:</strong> Use <strong>Google or GitHub login</strong> for Groq signup. Email login sometimes fails because the verification link doesn't work properly.
                  </p>
                </div>
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-accent hover:text-accent/80 font-semibold flex items-center gap-1">
                    <ChevronDown size={14} className="inline" />
                    Click for detailed Groq setup guide
                  </summary>
                  <div className="mt-3 space-y-3 pl-5 text-muted-foreground leading-relaxed">
                    <div>
                      <strong className="text-card-foreground">Step 1:</strong> Open a new tab and go to <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">console.groq.com</a>. You'll see the Groq Console homepage.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 2:</strong> Click "Sign Up" or "Get Started". You'll see login options. <strong>Choose "Continue with Google" or "Continue with GitHub"</strong> — do NOT use email signup as the verification emails are sometimes unreliable.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 3:</strong> After signing in, you'll be in the Groq Console dashboard. Look for "API Keys" in the left sidebar menu and click it.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 4:</strong> Click the "Create API Key" button. Give it a name (e.g., "ForgeCV") and click "Submit". Your new API key will appear — click the copy icon to copy it to your clipboard.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 5:</strong> Open ForgeCV extension, click the settings icon (⚙️), select "Groq" as your provider, paste your API key, and click "Save Settings".
                    </div>
                    <div>
                      <strong className="text-card-foreground">Why Groq?</strong> Groq offers a generous free tier with very fast inference speeds. It's perfect for resume generation and works great with ForgeCV.
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="bg-accent/10 border border-accent/30 rounded-md p-3">
                        <div className="text-xs font-semibold text-accent mb-2">🙋 Still stuck? Last Resort:</div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Copy this prompt and paste it into ChatGPT, Claude, or any AI chat:
                        </div>
                        <div
                          className="bg-muted/80 border border-border rounded p-2 text-xs font-mono text-card-foreground cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText("Explain how to get a free Groq API Key like I'm a time traveler from 1995 who just discovered the internet. Be super specific about clicking 'Create API Key'.");
                            alert('Prompt copied to clipboard!');
                          }}
                        >
                          "Explain how to get a free Groq API Key like I'm a time traveler from 1995 who just discovered the internet. Be super specific about clicking 'Create API Key'."
                        </div>
                        <div className="text-right text-[10px] text-accent mt-1">(Click to copy)</div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* API Key Setup - Gemini */}
            <div className="bg-foreground/[0.04] dark:bg-foreground/10 border border-border rounded-md overflow-hidden">
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-accent" />
                  <h4 className="font-bold text-sm text-card-foreground">Option 3: Get Free Google Gemini API Key (Alternative)</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Free Tier &nbsp;·&nbsp; Reliable &nbsp;·&nbsp; ~1 minute</p>
                <ol className="space-y-2 text-sm text-card-foreground">
                  <InstallStep n={1}>
                    Visit{" "}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                      aistudio.google.com/apikey
                      <ExternalLink size={12} />
                    </a>
                  </InstallStep>
                  <InstallStep n={2}>
                    Sign in with your Google account.
                  </InstallStep>
                  <InstallStep n={3}>
                    Click <strong>"Create API Key"</strong> → select or create a Google Cloud project.
                  </InstallStep>
                  <InstallStep n={4}>
                    Copy the generated API key → paste it into ForgeCV settings.
                  </InstallStep>
                </ol>
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-accent hover:text-accent/80 font-semibold flex items-center gap-1">
                    <ChevronDown size={14} className="inline" />
                    Click for detailed Gemini setup guide
                  </summary>
                  <div className="mt-3 space-y-3 pl-5 text-muted-foreground leading-relaxed">
                    <div>
                      <strong className="text-card-foreground">Step 1:</strong> Open a new tab and go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">aistudio.google.com/apikey</a>. This is Google's AI Studio API key page.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 2:</strong> Sign in with your Google account (any Gmail account works). If you're already signed into Chrome, it should sign you in automatically.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 3:</strong> Click the "Create API Key" button. You'll be asked to select a Google Cloud project. If you don't have one, click "Create new project", give it a name (e.g., "ForgeCV"), and click "Create".
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 4:</strong> Once the project is created, your API key will be generated and displayed. Click the copy icon to copy it to your clipboard.
                    </div>
                    <div>
                      <strong className="text-card-foreground">Step 5:</strong> Open ForgeCV extension, click the settings icon (⚙️), select "Gemini" as your provider, paste your API key, and click "Save Settings".
                    </div>
                    <div>
                      <strong className="text-card-foreground">Why Gemini?</strong> Google Gemini 2.0 Flash is very reliable and has a generous free tier. It's a great alternative if you prefer Google's ecosystem.
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="bg-accent/10 border border-accent/30 rounded-md p-3">
                        <div className="text-xs font-semibold text-accent mb-2">🙋 Still stuck? Last Resort:</div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Copy this prompt and paste it into ChatGPT, Claude, or any AI chat:
                        </div>
                        <div
                          className="bg-muted/80 border border-border rounded p-2 text-xs font-mono text-card-foreground cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText("Explain how to get a free Google Gemini API Key like I'm 5 years old and easily confused by buttons. Walk me through every click starting from opening Google.");
                            alert('Prompt copied to clipboard!');
                          }}
                        >
                          "Explain how to get a free Google Gemini API Key like I'm 5 years old and easily confused by buttons. Walk me through every click starting from opening Google."
                        </div>
                        <div className="text-right text-[10px] text-accent mt-1">(Click to copy)</div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* API Key Setup - OpenRouter */}
            <div className="bg-foreground/[0.04] dark:bg-foreground/10 border border-border rounded-md overflow-hidden mt-6">
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-accent" />
                  <h4 className="font-bold text-sm text-card-foreground">Option 4: OpenRouter API Key (Any Model)</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Paid/Free Models &nbsp;·&nbsp; Access Claude, GPT-4, etc.</p>
                <ol className="space-y-2 text-sm text-card-foreground">
                  <InstallStep n={1}>
                    Visit{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                      openrouter.ai/keys
                      <ExternalLink size={12} />
                    </a>
                  </InstallStep>
                  <InstallStep n={2}>Sign in (Google/GitHub/Email).</InstallStep>
                  <InstallStep n={3}>Click <strong>"Create Key"</strong>.</InstallStep>
                  <InstallStep n={4}>Copy key → paste into ForgeCV settings.</InstallStep>
                </ol>
              </div>
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== REFERENCES (Footer) ===== */}
          <footer className="pt-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">References</h3>
            <p className="text-sm text-card-foreground">Built by <strong>Pranay Saggar</strong> <span className="text-muted-foreground">· Powered by AI</span></p>
            <p className="text-sm text-muted-foreground mt-2">
              Check out my full portfolio and other projects at <a href="https://pranaysaggar.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-accent font-medium hover:underline">portfolio</a>.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Have feedback or ideas? Reach out to <a href="mailto:forgecvcontact@gmail.com" className="text-primary hover:text-accent font-medium hover:underline">forgecvcontact@gmail.com</a> or open a PR on GitHub.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-primary hover:text-accent transition-colors">
                <Linkedin size={18} />
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-primary hover:text-accent transition-colors">
                <Github size={18} />
              </a>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ForgeCV. All rights reserved.</p>
              <Button
                asChild
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold rounded-md"
              >
                <a href={DOWNLOAD_URL}>
                  <Download size={14} />
                  Download ForgeCV
                </a>
              </Button>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
};

/* ── Sub-components ── */

function SectionDivider() {
  return <Separator className="my-6 bg-primary/20" />;
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">{title}</h3>
      {children}
    </section>
  );
}

function ExperienceEntry({
  role, company, date, icon, bullets,
}: {
  role: string; company: string; date: string; icon: React.ReactNode; bullets: string[];
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h4 className="font-bold text-sm text-card-foreground">
              {role} <span className="font-normal text-muted-foreground">— {company}</span>
            </h4>
            <span className="text-xs italic text-muted-foreground whitespace-nowrap">{date}</span>
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-card-foreground list-disc list-outside ml-4">
            {bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ProblemBullet({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-primary mt-0.5">{icon}</span>
      <p className="text-card-foreground"><strong>{label}:</strong> {text}</p>
    </div>
  );
}

function SkillRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-primary">{label}:</span>{" "}
      <span className="text-card-foreground">{value}</span>
    </div>
  );
}

function InstallStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function CarouselSlide({ src, caption }: { src: string; caption: string }) {
  return (
    <CarouselItem className="basis-full sm:basis-1/2">
      <div className="p-1 h-full">
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm h-full flex flex-col p-2">
          <div className="flex-1 flex items-center justify-center bg-muted/20 rounded-lg">
            <img src={src} alt={caption} className="w-full h-auto object-contain rounded-md border border-border/40 shadow-sm" />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3 mb-1 font-medium italic">{caption}</p>
        </div>
      </div>
    </CarouselItem>
  );
}

export default Index;
