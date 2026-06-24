const DEFAULT_API_KEY = '';

function getApiKey() {
    const input = document.getElementById('apiKeyInput').value.trim();
    return input || DEFAULT_API_KEY;
}

document.addEventListener('DOMContentLoaded', () => {
    const gearBtn = document.getElementById('gearBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const toggleKeyVis = document.getElementById('toggleKeyVis');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultsSection = document.getElementById('resultsSection');

    gearBtn.addEventListener('click', () => {
        gearBtn.classList.toggle('active');
        settingsPanel.classList.toggle('open');
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
});

async function handleAnalyze() {
    const jobDesc = document.getElementById('jobDescription').value.trim();
    if (!jobDesc) {
        showError('Please paste a job description first.');
        return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        showError('No API key found. Open settings (gear icon) and enter your Anthropic API key.');
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';

    clearError();

    try {
        const result = await callClaude(apiKey, jobDesc);
        renderResults(result);
    } catch (err) {
        showError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

async function callClaude(apiKey, jobDescription) {
    const systemPrompt = `You are a career strategist and professional resume writer. You analyze job descriptions against a candidate's resume and produce tailored application materials.

IMPORTANT STYLE RULES for all output:
- Never use em dashes. Use commas, semicolons, periods, or parentheses instead.
- Write in a confident, precise, professional voice.
- Be honest about gaps. Do not fabricate experience.
- Resume bullets should start with strong action verbs and include quantified results where possible.

You will receive the candidate's resume and a job description. Respond with ONLY valid JSON (no markdown fences) in this exact structure:

{
  "matchScore": <number 0-100>,
  "strengths": ["strength 1", "strength 2", ...],
  "gaps": ["gap 1", "gap 2", ...],
  "bullets": ["bullet 1", "bullet 2", ...],
  "coverLetter": "full cover letter text"
}

For the cover letter:
- Address it generically (no company name unless in the job description)
- 3-4 paragraphs
- Confident and precise tone, no em dashes
- Connect the candidate's specific experience to the role's requirements
- Close with enthusiasm but not desperation`;

    const userMessage = `Here is my resume:

${MY_RESUME}

---

Here is the job description I am applying to:

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
            max_tokens: 4096,
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
