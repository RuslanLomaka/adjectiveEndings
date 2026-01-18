"use strict";

/* =========================
   Config & Constants
========================= */
const CONFIG = {
    QUESTIONS_PER_ROUND: 10,
    SUPPORTED_LANGS: ["en", "uk", "ro", "ar"],
    LANG_STORAGE_KEY: "adjQuizLang",
    HINT_STEPS: 3
};

const GRAMMAR_RULES = {
    akkusativ: `<table><tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr><tr><td>Bestimmt</td><td>den + <b>-en</b></td><td>die + <b>-e</b></td><td>das + <b>-e</b></td><td>die + <b>-en</b></td></tr><tr><td>Unbestimmt</td><td>einen + <b>-en</b></td><td>eine + <b>-e</b></td><td>ein + <b>-es</b></td><td>(keine) + <b>-en</b></td></tr><tr><td>Possessiv / kein</td><td>meinen/keinen + <b>-en</b></td><td>meine/keine + <b>-e</b></td><td>mein/kein + <b>-es</b></td><td>meine/keine + <b>-en</b></td></tr></table>`,
    dativ: `<table><tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr><tr><td>Bestimmt</td><td>dem + <b>-en</b></td><td>der + <b>-en</b></td><td>dem + <b>-en</b></td><td>den + <b>-en</b> (+n am Nomen)</td></tr><tr><td>Unbestimmt</td><td>einem + <b>-en</b></td><td>einer + <b>-en</b></td><td>einem + <b>-en</b></td><td>(keine) + <b>-en</b> (+n am Nomen)</td></tr><tr><td>Possessiv / kein</td><td>meinem/keinem + <b>-en</b></td><td>meiner/keiner + <b>-en</b></td><td>meinem/keinem + <b>-en</b></td><td>meinen/keinen + <b>-en</b> (+n am Nomen)</td></tr></table>`,
    genitiv: `<table><tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr><tr><td>Bestimmt</td><td>des + <b>-en</b></td><td>der + <b>-en</b></td><td>des + <b>-en</b></td><td>der + <b>-en</b></td></tr><tr><td>Unbestimmt</td><td>eines + <b>-en</b></td><td>einer + <b>-en</b></td><td>eines + <b>-en</b></td><td>(keine) + <b>-en</b></td></tr><tr><td>Possessiv / kein</td><td>meines/keines + <b>-en</b></td><td>meiner/keiner + <b>-en</b></td><td>meines/keines + <b>-en</b></td><td>meiner/keiner + <b>-en</b></td></tr></table>`,
};

/* =========================
   App State
========================= */
const state = {
    lang: "en",
    score: 0,
    answeredCount: 0,
    userAnswers: [],
    questions: [],
    isScrollBound: false
};

/* =========================
   DOM Cache
========================= */
const elements = {
    container: () => document.getElementById("questions-container"),
    modal: () => document.getElementById("grammar-modal"),
    scoreBox: () => document.getElementById("score-display"),
    tryAgainBtn: () => document.getElementById("try-again-button")
};

/* =========================
   Logic & Utilities
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
   Modal logic
========================= */
function openGrammarModal(fallRaw) {
    const modal = elements.modal();
    const fall = String(fallRaw || "").trim().toLowerCase();
    
    document.getElementById("modal-title").textContent = `${utils.capitalize(fall)} – Regeln`;
    document.getElementById("grammar-content").innerHTML = GRAMMAR_RULES[fall] || `<p>Keine Regeln verfügbar.</p>`;

    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeGrammarModal() {
    elements.modal().setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

/* =========================
   Quiz Core
========================= */
async function loadAndStartQuiz() {
    const container = elements.container();
    container.innerHTML = `<div class="question-container">Laden...</div>`;

    try {
        const response = await fetch("data.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        state.questions = utils.shuffle([...data]).slice(0, CONFIG.QUESTIONS_PER_ROUND);
        renderQuiz();
    } catch (err) {
        container.innerHTML = `<div class="question-container">Fehler: ${utils.escape(err.message)}</div>`;
    }
}

function renderQuiz() {
    const container = elements.container();
    container.innerHTML = state.questions.map((q, idx) => {
        utils.shuffle(q.answers);
        return `
            <div class="question-container" id="qc-${idx}">
                <div style="display:flex; justify-content:space-between; opacity:0.7; font-size:0.8rem;">
                    <span>${idx + 1}/${state.questions.length}</span>
                    <span>ID: ${utils.escape(q.id)}</span>
                </div>
                <div class="question-text" style="font-size:1.15rem; font-weight:700; margin: 10px 0;">
                    ${utils.escape(q.question)}
                </div>
                <div class="choices" data-q-idx="${idx}">
                    ${q.answers.map(a => `
                        <button class="choice-btn" type="button" data-correct="${a.correct}">
                            ${utils.escape(a.text)}
                        </button>
                    `).join("")}
                </div>
                <div class="hint-section" style="margin-top:10px;">
                    <button class="hint-btn" type="button" data-idx="${idx}">Hinweis</button>
                    <span id="hint-text-${idx}" style="margin-left:10px;"></span>
                </div>
                <div class="feedback" id="feedback-${idx}"></div>
            </div>`;
    }).join("");

    bindQuizEvents();
}

function bindQuizEvents() {
    const container = elements.container();

    // Answer Selection
    container.addEventListener("click", (e) => {
        const btn = e.target.closest(".choice-btn");
        if (!btn || btn.disabled) return;
        handleAnswer(btn);
    });

    // Hints
    container.addEventListener("click", (e) => {
        const btn = e.target.closest(".hint-btn");
        if (!btn || btn.disabled) return;
        handleHint(btn);
    });

    // Grammar Links
    container.addEventListener("click", (e) => {
        const link = e.target.closest(".case-link");
        if (!link) return;
        e.preventDefault();
        openGrammarModal(link.dataset.fall);
    });
}

function handleAnswer(btn) {
    const parent = btn.closest(".choices");
    const qIdx = parent.dataset.q_idx;
    const isCorrect = btn.dataset.correct === "true";
    
    state.userAnswers[qIdx] = { isCorrect, q: state.questions[qIdx], btn };
    state.answeredCount++;

    parent.querySelectorAll(".choice-btn").forEach(b => {
        b.disabled = true;
        if (b !== btn) b.style.opacity = "0.5";
    });

    btn.style.backgroundColor = "#17a2b8";
    btn.classList.add("selected");

    if (state.answeredCount === state.questions.length) {
        setTimeout(revealResults, 500);
    }
}

function handleHint(btn) {
    const idx = btn.dataset.idx;
    const q = state.questions[idx];
    const display = document.getElementById(`hint-text-${idx}`);
    
    btn.dataset.clicks = (Number(btn.dataset.clicks) || 0) + 1;
    const clicks = Number(btn.dataset.clicks);

    const fallLink = `<a class="case-link" href="#" data-fall="${utils.escape(q.case)}">${utils.escape(q.case)}</a>`;
    const translation = q.translations[state.lang] || q.translations.en;

    if (clicks === 1) display.textContent = `Geschlecht: ${q.gender}`;
    if (clicks === 2) display.innerHTML += ` | Fall: ${fallLink}`;
    if (clicks === 3) {
        display.innerHTML += ` | Übersetzung: ${utils.escape(translation)}`;
        btn.disabled = true;
        btn.style.opacity = "0.5";
    }
}

function revealResults() {
    state.score = 0;
    state.questions.forEach((q, idx) => {
        const ans = state.userAnswers[idx];
        const feedback = document.getElementById(`feedback-${idx}`);
        const hintDisplay = document.getElementById(`hint-text-${idx}`);
        const hintBtn = document.querySelector(`.hint-btn[data-idx="${idx}"]`);

        // Finalize feedback
        if (ans.isCorrect) {
            state.score++;
            ans.btn.style.backgroundColor = "#28a745";
            feedback.innerHTML = `<span class="correct">Richtig! 🎉 ${utils.escape(q.explanation)}</span>`;
        } else {
            ans.btn.style.backgroundColor = "#dc3545";
            feedback.innerHTML = `<span class="incorrect">Falsch! 😢 ${utils.escape(q.explanation)}</span>`;
        }

        // Forced Hint Reveal
        const fallLink = `<a class="case-link" href="#" data-fall="${utils.escape(q.case)}">${utils.escape(q.case)}</a>`;
        hintDisplay.innerHTML = `Geschlecht: ${q.gender} | Fall: ${fallLink} | Übersetzung: ${utils.escape(q.translations[state.lang] || q.translations.en)}`;
        if (hintBtn) hintBtn.disabled = true;
    });

    document.getElementById("final-score").textContent = `Punktzahl: ${state.score} / ${state.questions.length}`;
    elements.scoreBox().hidden = false;
    enableTryAgain();
}

/* =========================
   Language UI
========================= */
function initLanguage() {
    const select = document.getElementById("language-select");
    const saved = localStorage.getItem(CONFIG.LANG_STORAGE_KEY);
    
    state.lang = saved || (navigator.language.split('-')[0]) || "en";
    if (!CONFIG.SUPPORTED_LANGS.includes(state.lang)) state.lang = "en";
    
    select.value = state.lang;
    select.addEventListener("change", (e) => {
        state.lang = e.target.value;
        localStorage.setItem(CONFIG.LANG_STORAGE_KEY, state.lang);
    });
}

/* =========================
   Reset / Global Events
========================= */
function resetQuiz() {
    state.score = 0;
    state.answeredCount = 0;
    state.userAnswers = [];
    elements.scoreBox().hidden = true;
    elements.tryAgainBtn().hidden = true;
    loadAndStartQuiz();
}

function enableTryAgain() {
    const btn = elements.tryAgainBtn();
    btn.hidden = false;
    if (state.isScrollBound) return;
    state.isScrollBound = true;
    window.addEventListener("scroll", () => btn.classList.toggle("visible", window.scrollY < 100));
}

document.addEventListener("DOMContentLoaded", () => {
    initLanguage();
    loadAndStartQuiz();
    
    // Modal Backdrop close
    elements.modal().addEventListener("click", (e) => {
        if (e.target.dataset.close || e.target === elements.modal()) closeGrammarModal();
    });

    elements.tryAgainBtn().addEventListener("click", resetQuiz);
    
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeGrammarModal();
    });
});
