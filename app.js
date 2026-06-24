const DEFAULT_API_KEY = '';

function getApiKey() {
    const input = document.getElementById('apiKeyInput').value.trim();
    return input || DEFAULT_API_KEY;
}

document.addEventListener('DOMContentLoaded', () => {
    const gearBtn = document.getElementById('gearBtn');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const toggleKeyVis = document.getElementById('toggleKeyVis');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const tailorBtn = document.getElementById('tailorBtn');

    gearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gearBtn.classList.toggle('active');
        settingsDropdown.classList.toggle('open');
    });

    settingsDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', () => {
        gearBtn.classList.remove('active');
        settingsDropdown.classList.remove('open');
    });

    toggleKeyVis.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        apiKeyInput.type = isPassword ? 'text' : 'password';
    });

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const text = document.getElementById(targetId).innerText;
            navigator.clipboard.writeText(text).then(() => {
                btn.classList.add('copied');
                const originalHTML = btn.innerHTML;
                btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = originalHTML;
                }, 2000);
            });
        });
    });

    analyzeBtn.addEventListener('click', handleAnalyze);
    tailorBtn.addEventListener('click', handleTailor);
});

async function handleAnalyze() {
    const jobDesc = document.getElementById('jobDescription').value.trim();
    const resumeText = document.getElementById('resumeInput').value.trim();

    if (!jobDesc) {
        showError('Please paste a job description first.');
        return;
    }

    const resume = resumeText || MY_RESUME;

    const apiKey = getApiKey();
    if (!apiKey) {
        showError('No API key found. Click the gear icon and enter your Anthropic API key.');
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    setButtonLoading(btn, true);
    clearError();

    try {
        const result = await callClaude(apiKey, getDiagnosePrompt(), resume, jobDesc);
        renderResults(result);
        document.getElementById('tailorSection').style.display = 'block';
        document.getElementById('tailorResults').style.display = 'none';
    } catch (err) {
        showError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleTailor() {
    const jobDesc = document.getElementById('jobDescription').value.trim();
    const userResume = document.getElementById('resumeInput').value.trim();

    const apiKey = getApiKey();
    if (!apiKey) {
        showError('No API key found. Click the gear icon and enter your Anthropic API key.');
        return;
    }

    const btn = document.getElementById('tailorBtn');
    setButtonLoading(btn, true);

    const usePersonal = !!MY_RESUME && MY_RESUME !== 'PASTE YOUR RESUME HERE';
    const systemPrompt = usePersonal ? getPersonalTailorPrompt() : getPublicTailorPrompt();
    const resume = usePersonal ? MY_RESUME : userResume;

    try {
        const result = await callClaude(apiKey, systemPrompt, resume, jobDesc);
        renderTailorResults(result.tailoredResume);
    } catch (err) {
        showError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
        setButtonLoading(btn, false);
    }
}

function setButtonLoading(btn, loading) {
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');
    btn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoading.style.display = loading ? 'inline' : 'none';
}

function getDiagnosePrompt() {
    return `You are a career strategist. You analyze job descriptions against a candidate's resume and provide an honest diagnostic assessment.

IMPORTANT STYLE RULES for all output:
- Never use em dashes. Use commas, semicolons, periods, or parentheses instead.
- Write in a confident, precise, professional voice.
- Be completely honest about gaps. Do not fabricate or embellish.

You will receive the candidate's resume and a job description. Respond with ONLY valid JSON (no markdown fences) in this exact structure:

{
  "matchScore": <number 0-100>,
  "strengths": ["strength 1", "strength 2", ...],
  "gaps": ["gap 1", "gap 2", ...],
  "bullets": ["suggestion 1", "suggestion 2", ...],
  "coverLetter": "full cover letter text"
}

DIAGNOSE MODE RULES:
- Identify what matches well between the resume and the role
- Be honest and specific about gaps or missing qualifications
- For "bullets": suggest areas the candidate should strengthen or reframe, NOT rewritten resume bullets. These are coaching suggestions, not rewrites.
- For the cover letter: use ONLY content and experience that appears in the candidate's actual resume. Do not add, invent, or embellish any experience. 3-4 paragraphs, confident tone.`;
}

function getPublicTailorPrompt() {
    return `You are a career strategist and resume writer. You help candidates reframe their existing experience to better match a target role.

IMPORTANT STYLE RULES for all output:
- Never use em dashes. Use commas, semicolons, periods, or parentheses instead. Use -- for title separators.
- Professional tone: confident, precise, specific, and concrete.
- No vague AI phrasing ("leveraging synergies", "passionate about", "excited to bring"). Be direct and substantive.
- Vary sentence length. Mix short punchy sentences with longer detailed ones.
- Resume bullets must start with strong action verbs and include quantified results where possible.
- Output clean plain text only. No markdown formatting, no bold, no headers with #.

You will receive the candidate's resume and a job description. Respond with ONLY valid JSON (no markdown fences) in this exact structure:

{
  "tailoredResume": "full resume text as a single string with newlines"
}

The tailoredResume must follow the EXACT structure of the original resume:
1. PROFESSIONAL SUMMARY (rewritten to align with this role)
2. CORE COMPETENCIES (adjusted keywords for this JD)
3. Each company section with original company name, title, and dates, followed by 3-5 reframed bullets
4. EDUCATION section (unchanged from original)

PUBLIC TAILOR MODE RULES:
- Reframe and reword the candidate's EXISTING bullets to better align with the job description
- NEVER add, invent, or imply experience, skills, or accomplishments not present in the original resume
- You may restructure, combine, or re-emphasize existing content, but every claim must trace back to something in the resume
- Quantify results only where the original resume already provides the data
- Keep the Education section exactly as-is`;
}

function getPersonalTailorPrompt() {
    return `You are an elite career strategist and resume writer working with a senior operations and intelligence leader. You have deep knowledge of this candidate's full background and produce highly tailored application materials.

IMPORTANT STYLE RULES for all output:
- Never use em dashes. Use commas, semicolons, periods, or parentheses instead. Use -- for title separators.
- Professional tone: confident, precise, specific, and concrete.
- No vague AI phrasing ("leveraging synergies", "passionate about", "excited to bring"). Be direct and substantive.
- Vary sentence length. Mix short punchy sentences with longer detailed ones.
- Resume bullets must start with strong action verbs and include quantified results where possible.
- Output clean plain text only. No markdown formatting, no bold, no headers with #.

You will receive the candidate's full resume knowledge base and a job description. Respond with ONLY valid JSON (no markdown fences) in this exact structure:

{
  "tailoredResume": "full resume text as a single string with newlines"
}

The tailoredResume must follow this EXACT structure:

PROFESSIONAL SUMMARY
(rewritten to position the candidate for this specific role)

CORE COMPETENCIES
(adjusted keywords and phrases to match this JD)

MICROSOFT -- Program Lead, Strategic Data & Operations (2025-2026)
- bullet 1
- bullet 2
- bullet 3

JLL @ GOOGLE -- Director, BI Analytics & Center of Excellence (2022-2024)
- bullet 1
- bullet 2
- bullet 3

WELLS FARGO -- Principal, Advanced Business Analytics (2021-2022)
- bullet 1
- bullet 2
- bullet 3

CISCO SYSTEMS -- Program Manager, Enterprise Data Strategy & Metrics (2004-2021)
- bullet 1
- bullet 2
- bullet 3

EDUCATION
MBA (High Honors), Golden Gate University
BS Computer Science (High Honors), San Jose State University
Technical: SQL, DAX, R, Python, VS Code, Next.js, Supabase, Claude Code, Power BI, Tableau
Certifications: Google Data Analytics Professional; Certified in Agentic AI Workflows (Anthropic)

PERSONAL TAILOR MODE RULES:
- 3-5 bullets per company, rewritten to align with the JD
- Where an important gap exists relative to the JD, add a new bullet drawing from the full resume knowledge base to fill it
- Fully optimize and craft bullets for the best possible JD match
- Draw from the candidate's entire resume knowledge base to select, combine, and rewrite the strongest bullets
- Quantify results wherever the source data supports it
- The candidate will review all output before sending, so optimize aggressively for fit
- Keep the Education section exactly as shown above, unchanged`;
}

async function callClaude(apiKey, systemPrompt, resume, jobDescription) {
    const userMessage = `Here is the candidate's resume:

${resume}

---

Here is the job description to evaluate against:

${jobDescription}

---

Analyze the fit and generate all requested materials. Return ONLY the JSON object.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 6000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
            throw new Error('Invalid API key. Check your key in settings.');
        }
        throw new Error(errorData.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
}

function renderResults(data) {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    renderScore(data.matchScore);
    renderSummary(data);
    renderBullets(data.bullets);
    renderCoverLetter(data.coverLetter);

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="summary"]').classList.add('active');
    document.getElementById('tab-summary').classList.add('active');
}

function renderTailorResults(resumeText) {
    const container = document.getElementById('tailorBulletsText');
    container.textContent = resumeText;

    const tailorResults = document.getElementById('tailorResults');
    tailorResults.style.display = 'block';
    tailorResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderScore(score) {
    const container = document.getElementById('scoreContainer');
    const circumference = 2 * Math.PI * 58;
    const offset = circumference - (score / 100) * circumference;

    let color = 'var(--danger)';
    if (score >= 70) color = 'var(--success)';
    else if (score >= 45) color = 'var(--warning)';

    container.innerHTML = `
        <div class="score-ring">
            <svg width="140" height="140">
                <circle class="bg-ring" cx="70" cy="70" r="58" fill="none" stroke-width="8"/>
                <circle class="fg-ring" cx="70" cy="70" r="58" fill="none" stroke-width="8"
                    stroke="${color}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${circumference}"
                    stroke-linecap="round"/>
            </svg>
            <div class="score-label">
                <div class="score-number" style="color:${color}">0</div>
                <div class="score-percent">match</div>
            </div>
        </div>`;

    requestAnimationFrame(() => {
        const ring = container.querySelector('.fg-ring');
        const num = container.querySelector('.score-number');
        ring.style.strokeDashoffset = offset;

        let current = 0;
        const step = Math.max(1, Math.floor(score / 40));
        const interval = setInterval(() => {
            current += step;
            if (current >= score) {
                current = score;
                clearInterval(interval);
            }
            num.textContent = current;
        }, 25);
    });
}

function renderSummary(data) {
    const container = document.getElementById('summaryContent');
    container.innerHTML = `
        <div class="section-block">
            <h3><span class="icon">&#9679;</span> Key Strengths</h3>
            <ul class="strengths-list">
                ${data.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ul>
        </div>
        <div class="section-block">
            <h3><span class="icon">&#9651;</span> Gaps to Address</h3>
            <ul class="gaps-list">
                ${data.gaps.map(g => `<li>${escapeHtml(g)}</li>`).join('')}
            </ul>
        </div>`;
}

function renderBullets(bullets) {
    const container = document.getElementById('bulletsText');
    container.innerHTML = `
        <ul>
            ${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>`;
}

function renderCoverLetter(text) {
    document.getElementById('coverLetterText').textContent = text;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showError(msg) {
    clearError();
    const container = document.querySelector('.input-section');
    const div = document.createElement('div');
    div.className = 'error-msg';
    div.textContent = msg;
    container.appendChild(div);
}

function clearError() {
    document.querySelectorAll('.error-msg').forEach(el => el.remove());
}
