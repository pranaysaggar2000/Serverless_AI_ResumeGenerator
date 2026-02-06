import { Github, Linkedin, Download, Shield, Sparkles, GripVertical, Globe, Lock, DollarSign, Terminal, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const DOWNLOAD_URL = "https://github.com/pranaysaggar2000/Serverless_AI_ResumeGenerator/releases/latest/download/extension.zip";
const GITHUB_URL = "https://github.com/pranaysaggar/ForgeCV";
const LINKEDIN_URL = "https://linkedin.com/in/pranaysaggar";

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
                  Senior Resume Optimizer &nbsp;|&nbsp; Chrome Extension &nbsp;|&nbsp; v1.0.0
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold border border-border rounded px-2 py-1 text-muted-foreground">
                  v1.0.0
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
              <Button
                asChild
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 text-base font-bold px-8 rounded-md shadow-md"
              >
                <a href={DOWNLOAD_URL}>
                  <Download size={18} />
                  Download for Chrome (v1.0.0)
                </a>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                No data leaves your device. No backend server. Open Source.
              </p>
            </div>
          </header>

          <SectionDivider />

          {/* ===== PROFESSIONAL SUMMARY ===== */}
          <ResumeSection title="Professional Summary">
            <p className="text-sm leading-relaxed text-card-foreground">
              A 100% free, privacy-first Chrome Extension that tailors your resume to any job
              description using AI. Runs entirely in your browser using your own Gemini or Groq
              API key. No subscriptions. No servers. No data collection.
            </p>
          </ResumeSection>

          <SectionDivider />

          {/* ===== EXPERIENCE ===== */}
          <ResumeSection title="Experience">
            <ExperienceEntry
              role="Smart Tailoring Engine"
              company="ForgeCV Labs"
              date="Sep 2025 – Present"
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
              date="Sep 2025 – Present"
              icon={<Shield size={16} className="text-accent" />}
              bullets={[
                "Operates 100% client-side with zero backend servers — no Vercel, no Heroku, nothing",
                "Resume data travels only from your browser directly to Google/Groq and back",
                "All state persisted locally via chrome.storage — we literally cannot see your data",
              ]}
            />
            <ExperienceEntry
              role="Advanced Resume Editor"
              company="ForgeCV Labs"
              date="Sep 2025 – Present"
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
                text="Competitors charge $20+/month just to rewrite a few bullet points."
              />
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== SKILLS ===== */}
          <ResumeSection title="Skills">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <SkillRow label="AI Providers" value="Google Gemini 2.0 Flash, Groq Llama 3.3" />
              <SkillRow label="Platform" value="Chrome Extension (Manifest V3)" />
              <SkillRow label="PDF Engine" value="pdf.js (input), jsPDF (output)" />
              <SkillRow label="Architecture" value="Serverless, Client-Side, ES6 Modules" />
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== EDUCATION (Installation) ===== */}
          <ResumeSection title="Education">
            <div className="bg-foreground/[0.04] dark:bg-foreground/10 border border-border rounded-md overflow-hidden">
              <div className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 mb-1">
                  <Terminal size={16} className="text-accent" />
                  <h4 className="font-bold text-sm text-card-foreground">Chrome Extension Installation</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Self-Paced &nbsp;·&nbsp; ~2 minutes</p>
                <ol className="space-y-2 text-sm text-card-foreground">
                  <InstallStep n={1}>Download the ZIP file above and unzip it to a folder.</InstallStep>
                  <InstallStep n={2}>
                    Open Chrome → navigate to{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">chrome://extensions</code>
                  </InstallStep>
                  <InstallStep n={3}>Toggle <strong>"Developer Mode"</strong> ON (top-right corner).</InstallStep>
                  <InstallStep n={4}>Click <strong>"Load Unpacked"</strong> → select the unzipped folder.</InstallStep>
                </ol>
              </div>
            </div>
          </ResumeSection>

          <SectionDivider />

          {/* ===== REFERENCES (Footer) ===== */}
          <footer className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">References</h3>
            <p className="text-sm text-card-foreground">Built by <strong>Pranay Saggar</strong></p>
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

export default Index;
