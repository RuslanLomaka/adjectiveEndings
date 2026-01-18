"use strict";

/* =========================
   1. Config & Pedagogical Assets
========================= */
const CONFIG = {
    QUESTIONS_PER_ROUND: 10,
    SUPPORTED_LANGS: ["en", "uk", "ro", "ar"],
    LANG_STORAGE_KEY: "adjQuizLang",
    // Color coding aids mental categorization of grammar rules
    COLORS: {
        akkusativ: "#28a745", // Green
        dativ: "#007bff",     // Blue
        genitiv: "#dc3545",   // Red
        neutral: "#6c757d"    // Grey
    }
};

const GRAMMAR_RULES = {
    akkusativ: `
    <table class="rules-table">
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>den + <b>-en</b></td><td>die + <b>-e</b></td><td>das + <b>-e</b></td><td>die + <b>-en</b></td></tr>
      <tr><td>Unbestimmt</td><td>einen + <b>-en</b></td><td>eine + <b>-e</b></td><td>ein + <b>-es</b></td><td>(keine) + <b>-en</b></td></tr>
      <tr><td>Possessiv</td><td>meinen + <b>-en</b></td><td>meine + <b>-e</b></td><td>mein + <b>-es</b></td><td>meine + <b>-en</b></td></tr>
    </table>`,
    dativ: `
    <table class="rules-table">
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>dem + <b>-en</b></td><td>der + <b>-en</b></td><td>dem + <b>-en</b></td><td>den + <b>-en</b> (+n)</td></tr>
      <tr><td>Unbestimmt</td><td>einem + <b>-en</b></td><td>einer + <b>-en</b></td><td>einem + <b>-en</b></td><td>(keine) + <b>-en</b> (+n)</td></tr>
      <tr><td>Possessiv</td><td>meinem + <b>-en</b></td><td>meiner + <b>-en</b></td><td>meinem + <b>-en</b></td><td>meinen + <b>-en</b> (+n)</td></tr>
    </table>`,
    genitiv: `
    <table class="rules-table">
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>des + <b>-en</b></td><td>der + <b>-en</b></td><td>des + <b>-en</b></td><td>der + <b>-en</b></td></tr>
      <tr><td>Unbestimmt</td><td>eines + <b>-en</b></td><td>einer + <b>-en</b></td><td>eines + <b>-en</b></td><td>(keine) + <b>-en</b></td></tr>
      <tr><td>Possessiv</td><td>meines + <b>-en</b></td><td>meiner + <b>-en</b></td><td>meines + <b>-en</b></td><td>meiner + <b>-en</b></td></tr>
    </table>`
};

/* =========================
   2. Application State
========================= */
const state = {
    lang: "en",
    questions: [],
    userAnswers: [],
    answeredCount: 0,
    score: 0,
    // Track case performance for final feedback
    stats: {
        akkusativ: { correct: 0, total: 0 },
        dativ: { correct: 0, total: 0 },
        genitiv: { correct: 0, total: 0 }
    }
};

/* =========================
   3. Utilities
========================= */
const utils = {
    escape: (s) => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])),
    capitalize: (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "",
    shuffle: (a) => {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
};

/* =========================
   4. Core Functions
========================= */
async function loadAndStartQuiz() {
    const container = document.getElementById("questions-container");
    container.innerHTML = `<div class="loading">Wird geladen...</div>`;

    try {
        const r = await fetch("data.json", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        
        // Pick a fresh random set
        state.questions = utils.shuffle([...data]).slice(0, CONFIG.QUESTIONS_PER_ROUND);
        renderQuiz();
    } catch (err) {
        container.innerHTML = `<div class="error">Fehler: ${utils.escape(err.message)}</div>`;
    }
}

function renderQuiz() {
    const container = document.getElementById("questions-container");
    container.innerHTML = state.questions.map((q, idx) => {
        utils.shuffle(q.answers);
        return `
            <div class="question-container" id="qc-${idx}">
                <div class="q-header">
                    <span>Frage ${idx + 1}/${state.questions.length}</span>
                    <span class="q-id">ID: ${utils.escape(q.id)}</span>
                </div>
                <div class="question-text">${utils.escape(q.question)}</div>
                <div class="choices" data-q-idx="${idx}">
                    ${q.answers.map(a => `
                        <button class="choice-btn" type="button" data-correct="${a.correct}">
                            ${utils.escape(a.text)}
                        </button>
                    `).join("")}
                </div>
                <div class="hint-section">
                    <button class="hint-btn" type="button" data-idx="${idx}">Hinweis</button>
                    <span id="hint-text-${idx}" class="hint-text"></span>
                </div>
                <div class="feedback" id="feedback-${idx}"></div>
            </div>`;
    }).join("");
    bindEvents();
}

/* =========================
   5. Interaction Logic
========================= */
function bindEvents() {
    const container = document.getElementById("questions-container");

    // Event Delegation: One listener for efficiency
    container.addEventListener("click", (e) => {
        const target = e.target;
        
        // Handle Answer Selection
        if (target.classList.contains("choice-btn") && !target.disabled) {
            handleAnswer(target);
        }
        
        // Handle Hints (Progressive Disclosure)
        if (target.classList.contains("hint-btn") && !target.disabled) {
            handleHint(target);
        }

        // Handle Grammar Modal Links
        if (target.classList.contains("case-link")) {
            e.preventDefault();
            openGrammarModal(target.dataset.fall);
        }
    });
}

function handleAnswer(btn) {
    const parent = btn.closest(".choices");
    const idx = parent.dataset.q_idx;
    const q = state.questions[idx];
    const isCorrect = btn.dataset.correct === "true";

    state.userAnswers[idx] = { isCorrect, q, btn };
    state.answeredCount++;
    state.stats[q.case].total++;

    parent.querySelectorAll(".choice-btn").forEach(b => {
        b.disabled = true;
        if (b !== btn) b.style.opacity = "0.4";
    });

    btn.classList.add("selected");
    btn.style.backgroundColor = "#17a2b8";

    if (state.answeredCount === state.questions.length) {
        setTimeout(revealResults, 600);
    }
}



function handleHint(btn) {
    const idx = btn.dataset.idx;
    const q = state.questions[idx];
    const textSpan = document.getElementById(`hint-text-${idx}`);
    
    // Track clicks to provide gradual help
    let clicks = parseInt(btn.dataset.clicks || "0") + 1;
    btn.dataset.clicks = clicks;

    if (clicks === 1) {
        textSpan.innerHTML = `<strong>Genus:</strong> ${utils.escape(q.gender)}`;
    } else if (clicks === 2) {
        const color = CONFIG.COLORS[q.case] || CONFIG.COLORS.neutral;
        textSpan.innerHTML += ` | <strong>Fall:</strong> <a class="case-link" style="color:${color}" data-fall="${q.case}">${q.case}</a>`;
    } else if (clicks === 3) {
        const trans = q.translations[state.lang] || q.translations.en;
        textSpan.innerHTML += `<br><small>Übersetzung: ${utils.escape(trans)}</small>`;
        btn.disabled = true;
        btn.style.opacity = "0.5";
    }
}

function revealResults() {
    state.score = 0;
    state.questions.forEach((q, idx) => {
        const ans = state.userAnswers[idx];
        const feedback = document.getElementById(`feedback-${idx}`);
        const hintText = document.getElementById(`hint-text-${idx}`);

        // Immediate pedagogical feedback
        if (ans.isCorrect) {
            state.score++;
            state.stats[q.case].correct++;
            ans.btn.style.backgroundColor = CONFIG.COLORS.akkusativ; // Green for success
            feedback.innerHTML = `<span class="correct">Richtig! ${utils.escape(q.explanation)}</span>`;
        } else {
            ans.btn.style.backgroundColor = CONFIG.COLORS.genitiv; // Red for error
            feedback.innerHTML = `<span class="incorrect">Falsch. Das ist ${q.case}. ${utils.escape(q.explanation)}</span>`;
        }

        // Full disclosure after finish
        const trans = q.translations[state.lang] || q.translations.en;
        hintText.innerHTML = `Genus: ${q.gender} | Fall: ${q.case} | Übersetzung: ${utils.escape(trans)}`;
    });

    displayFinalSummary();
}

function displayFinalSummary() {
    const scoreEl = document.getElementById("final-score");
    const feedbackEl = document.getElementById("final-feedback");
    
    scoreEl.textContent = `Ergebnis: ${state.score} / ${state.questions.length}`;
    
    // Build performance breakdown per case (Metacognition)
    let summary = "<strong>Deine Statistik nach Fällen:</strong><br>";
    for (const [key, val] of Object.entries(state.stats)) {
        if (val.total > 0) {
            summary += `${utils.capitalize(key)}: ${val.correct}/${val.total}<br>`;
        }
    }
    feedbackEl.innerHTML = summary;
    
    document.getElementById("score-display").hidden = false;
    document.getElementById("try-again-button").hidden = false;
}

/* =========================
   6. Global Event Listeners
========================= */
document.addEventListener("DOMContentLoaded", () => {
    // Language setup
    const langSelect = document.getElementById("language-select");
    state.lang = localStorage.getItem(CONFIG.LANG_STORAGE_KEY) || "en";
    langSelect.value = state.lang;
    langSelect.addEventListener("change", (e) => {
        state.lang = e.target.value;
        localStorage.setItem(CONFIG.LANG_STORAGE_KEY, state.lang);
    });

    // Start
    loadAndStartQuiz();

    // Try Again
    document.getElementById("try-again-button").addEventListener("click", () => {
        state.answeredCount = 0;
        state.userAnswers = [];
        state.stats = { akkusativ: { correct: 0, total: 0 }, dativ: { correct: 0, total: 0 }, genitiv: { correct: 0, total: 0 } };
        document.getElementById("score-display").hidden = true;
        loadAndStartQuiz();
    });

    // Modal behavior
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeGrammarModal(); });
});

/* =========================
   7. Grammar Modal Helpers
========================= */
function openGrammarModal(fall) {
    const modal = document.getElementById("grammar-modal");
    document.getElementById("modal-title").textContent = `${utils.capitalize(fall)} Regeln`;
    document.getElementById("grammar-content").innerHTML = GRAMMAR_RULES[fall] || "Keine Regeln verfügbar.";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeGrammarModal() {
    document.getElementById("grammar-modal").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}
