"use strict";

/* =========================
   1. Config & Pedagogical Assets
========================= */
const QUESTIONS_PER_ROUND = 10;
const SUPPORTED_LANGS = ["en", "uk", "ro", "ar"];
const LANG_STORAGE_KEY = "adjQuizLang";

const COLORS = {
    akkusativ: "#28a745", // Green
    dativ: "#007bff",     // Blue
    genitiv: "#dc3545",   // Red
    neutral: "#6c757d"
};

const GRAMMAR_RULES = {
    akkusativ: `
    <div class="modal-hint"><b>Trigger:</b> durch, für, gegen, ohne, um | Verben: sehen, haben, kaufen...</div>
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>den + <b>-en</b></td><td>die + <b>-e</b></td><td>das + <b>-e</b></td><td>die + <b>-en</b></td></tr>
      <tr><td>Unbestimmt</td><td>einen + <b>-en</b></td><td>eine + <b>-e</b></td><td>ein + <b>-es</b></td><td>(keine) + <b>-en</b></td></tr>
    </table>`,
    dativ: `
    <div class="modal-hint"><b>Trigger:</b> aus, bei, mit, nach, von, zu | Verben: helfen, danken, folgen...</div>
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>dem + <b>-en</b></td><td>der + <b>-en</b></td><td>dem + <b>-en</b></td><td>den + <b>-en</b> (+n)</td></tr>
      <tr><td>Unbestimmt</td><td>einem + <b>-en</b></td><td>einer + <b>-en</b></td><td>einem + <b>-en</b></td><td>(keine) + <b>-en</b> (+n)</td></tr>
    </table>`,
    genitiv: `
    <div class="modal-hint"><b>Trigger:</b> während, wegen, trotz, statt | Zeigt Besitz an.</div>
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>des + <b>-en</b></td><td>der + <b>-en</b></td><td>des + <b>-en</b></td><td>der + <b>-en</b></td></tr>
    </table>`
};

/* =========================
   2. State
========================= */
let selectedLanguage = "en";
let score = 0;
let answeredCount = 0;
let currentQuestions = [];
const userAnswers = [];

/* =========================
   3. Initialization
========================= */
document.addEventListener("DOMContentLoaded", () => {
    initLanguageUI();
    wireModalHandlers();
    loadAndStartQuiz();
    
    // Global listener for Try Again
    document.getElementById("try-again-button").addEventListener("click", resetQuiz);
});

function initLanguageUI() {
    const select = document.getElementById("language-select");
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    selectedLanguage = (saved && SUPPORTED_LANGS.includes(saved)) ? saved : "en";
    select.value = selectedLanguage;
    select.addEventListener("change", (e) => {
        selectedLanguage = e.target.value;
        localStorage.setItem(LANG_STORAGE_KEY, selectedLanguage);
    });
}

/* =========================
   4. Quiz Logic
========================= */
function loadAndStartQuiz() {
    fetch("data.json", { cache: "no-store" })
        .then(r => r.json())
        .then(data => {
            currentQuestions = getRandomSubset(data, Math.min(QUESTIONS_PER_ROUND, data.length));
            renderQuestions(currentQuestions);
            updateProgressBar();
        })
        .catch(err => console.error("Load error:", err));
}

function renderQuestions(questions) {
    const container = document.getElementById("questions-container");
    container.innerHTML = questions.map((q, idx) => {
        shuffleArray(q.answers);
        const borderColor = COLORS[q.case] || COLORS.neutral;
        return `
            <div class="question-container" id="qc-${idx}" style="border-left: 8px solid ${borderColor}">
                <div class="q-meta">
                    <span>${idx + 1}/${questions.length}</span>
                    <span class="case-label" style="background:${borderColor}">${q.case}</span>
                </div>
                <div class="question-text">${escapeHtml(q.question)}</div>
                <div class="choices" data-qidx="${idx}">
                    ${q.answers.map(a => `<button class="choice-btn" data-correct="${a.correct}">${escapeHtml(a.text)}</button>`).join("")}
                </div>
                <div class="hint-section">
                    <button class="hint-btn" data-idx="${idx}">Hinweis</button>
                    <span id="hint-text-${idx}" class="hint-text"></span>
                </div>
                <div class="feedback" id="feedback-${idx}"></div>
            </div>`;
    }).join("");
    
    bindInteractions();
}

function bindInteractions() {
    const container = document.getElementById("questions-container");

    // Event Delegation for efficiency
    container.onclick = (e) => {
        const target = e.target;

        // Answer Selection
        if (target.classList.contains("choice-btn") && !target.disabled) {
            handleSelection(target);
        }

        // Progressive Hints
        if (target.classList.contains("hint-btn")) {
            handleHint(target);
        }

        // Case Link in results
        if (target.classList.contains("case-link")) {
            e.preventDefault();
            openGrammarModal(target.dataset.fall);
        }
    };
}

function handleSelection(btn) {
    const parent = btn.closest(".choices");
    const qIdx = Number(parent.dataset.qidx);
    const isCorrect = btn.dataset.correct === "true";

    // Update State
    userAnswers[qIdx] = { isCorrect, q: currentQuestions[qIdx], button: btn };
    answeredCount++;
    if (isCorrect) score++;

    // UI Update
    parent.querySelectorAll(".choice-btn").forEach(b => {
        b.disabled = true;
        if (b !== btn) b.style.opacity = "0.4";
    });
    btn.classList.add("selected");
    
    updateProgressBar();

    if (answeredCount === currentQuestions.length) {
        setTimeout(revealResults, 600);
    }
}



function handleHint(btn) {
    const idx = btn.dataset.idx;
    const q = currentQuestions[idx];
    const span = document.getElementById(`hint-text-${idx}`);
    let step = parseInt(btn.dataset.step || "0") + 1;
    btn.dataset.step = step;

    if (step === 1) span.innerHTML = `Genus: <b>${q.gender}</b>`;
    if (step === 2) span.innerHTML += ` | Fall: <b>${q.case}</b>`;
    if (step === 3) {
        const trans = q.translations[selectedLanguage] || q.translations.en;
        span.innerHTML += `<br><small>Übersetzung: ${escapeHtml(trans)}</small>`;
        btn.disabled = true;
    }
}

function revealResults() {
    const stats = { akkusativ: 0, dativ: 0, genitiv: 0, total: { akkusativ: 0, dativ: 0, genitiv: 0 } };

    userAnswers.forEach((ans, idx) => {
        const feedback = document.getElementById(`feedback-${idx}`);
        const hintText = document.getElementById(`hint-text-${idx}`);
        const q = ans.q;

        stats.total[q.case]++;
        if (ans.isCorrect) {
            stats[q.case]++;
            ans.button.style.backgroundColor = COLORS.akkusativ;
            feedback.innerHTML = `<span class="correct">Richtig! ${escapeHtml(q.explanation)}</span>`;
        } else {
            ans.button.style.backgroundColor = COLORS.genitiv;
            feedback.innerHTML = `<span class="incorrect">Falsch. ${escapeHtml(q.explanation)}</span>`;
        }

        const trans = q.translations[selectedLanguage] || q.translations.en;
        const caseLink = `<a href="#" class="case-link" data-fall="${q.case}">${q.case}</a>`;
        hintText.innerHTML = `Genus: ${q.gender} | Fall: ${caseLink} | Übersetzung: ${escapeHtml(trans)}`;
    });

    displaySummary(stats);
}

function displaySummary(stats) {
    document.getElementById("final-score").textContent = `Ergebnis: ${score} / ${currentQuestions.length}`;
    
    let breakdown = "<b>Statistik nach Fällen:</b><br>";
    for (let c in stats.total) {
        if (stats.total[c] > 0) {
            breakdown += `${capitalize(c)}: ${stats[c]}/${stats.total[c]}<br>`;
        }
    }
    
    document.getElementById("final-feedback").innerHTML = breakdown;
    document.getElementById("score-display").hidden = false;
    document.getElementById("try-again-button").hidden = false;
}

/* =========================
   5. Helpers & UI
========================= */
function updateProgressBar() {
    const progress = (answeredCount / QUESTIONS_PER_ROUND) * 100;
    document.getElementById("progress-fill").style.width = `${progress}%`;
    document.getElementById("live-progress").textContent = `Frage: ${answeredCount} / ${QUESTIONS_PER_ROUND}`;
    document.getElementById("live-score").textContent = `Richtig: ${score}`;
}

function resetQuiz() {
    score = 0;
    answeredCount = 0;
    userAnswers.length = 0;
    document.getElementById("score-display").hidden = true;
    document.getElementById("try-again-button").hidden = true;
    loadAndStartQuiz();
}

function openGrammarModal(fall) {
    const modal = document.getElementById("grammar-modal");
    document.getElementById("modal-title").textContent = `${capitalize(fall)} Regeln`;
    document.getElementById("grammar-content").innerHTML = GRAMMAR_RULES[fall.toLowerCase()] || "Regeln nicht gefunden.";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function wireModalHandlers() {
    const modal = document.getElementById("grammar-modal");
    modal.onclick = (e) => {
        if (e.target.dataset.close || e.target === modal) {
            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        }
    };
}

function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
}

function getRandomSubset(arr, n) {
    const copy = [...arr];
    shuffleArray(copy);
    return copy.slice(0, n);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]));
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
