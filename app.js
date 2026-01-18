"use strict";

/* =========================
   1. Config & Pedagogical Assets
========================= */
const QUESTIONS_PER_ROUND = 10;
const SUPPORTED_LANGS = ["en", "uk", "ro", "ar"];
const LANG_STORAGE_KEY = "adjQuizLang";

const COLORS = {
    akkusativ: "#28a745",
    dativ: "#007bff",
    genitiv: "#dc3545",
    neutral: "#6c757d"
};

const GRAMMAR_RULES = {
    akkusativ: `
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>den + <b>-en</b></td><td>die + <b>-e</b></td><td>das + <b>-e</b></td><td>die + <b>-en</b></td></tr>
      <tr><td>Unbestimmt</td><td>einen + <b>-en</b></td><td>eine + <b>-e</b></td><td>ein + <b>-es</b></td><td>(keine) + <b>-en</b></td></tr>
      <tr><td>Possessiv</td><td>meinen + <b>-en</b></td><td>meine + <b>-e</b></td><td>mein + <b>-es</b></td><td>meine + <b>-en</b></td></tr>
    </table>`,
    dativ: `
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>dem + <b>-en</b></td><td>der + <b>-en</b></td><td>dem + <b>-en</b></td><td>den + <b>-en</b> (+n)</td></tr>
      <tr><td>Unbestimmt</td><td>einem + <b>-en</b></td><td>einer + <b>-en</b></td><td>einem + <b>-en</b></td><td>(keine) + <b>-en</b> (+n)</td></tr>
      <tr><td>Possessiv</td><td>meinem + <b>-en</b></td><td>meiner + <b>-en</b></td><td>meinem + <b>-en</b></td><td>meinen + <b>-en</b> (+n)</td></tr>
    </table>`,
    genitiv: `
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>des + <b>-en</b></td><td>der + <b>-en</b></td><td>des + <b>-en</b></td><td>der + <b>-en</b></td></tr>
      <tr><td>Unbestimmt</td><td>eines + <b>-en</b></td><td>einer + <b>-en</b></td><td>eines + <b>-en</b></td><td>(keine) + <b>-en</b></td></tr>
      <tr><td>Possessiv</td><td>meines + <b>-en</b></td><td>meiner + <b>-en</b></td><td>meines + <b>-en</b></td><td>meiner + <b>-en</b></td></tr>
    </table>`
};

/* =========================
   2. State
========================= */
let selectedLanguage = "en";
let score = 0;
let answeredQuestions = 0;
let currentQuestions = [];
const userAnswers = []; // Your original array-based tracking

/* =========================
   3. Boot & Initialization
========================= */
document.addEventListener("DOMContentLoaded", () => {
    initLanguageUI();
    wireModalCloseHandlers();
    loadAndStartQuiz();
    wireTryAgain();
});

function initLanguageUI() {
    const select = document.getElementById("language-select");
    if (!select) return;
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
            displayAllQuestions(currentQuestions);
        })
        .catch(err => console.error("Quiz load error:", err));
}

function displayAllQuestions(questions) {
    const container = document.getElementById("questions-container");
    if (!container) return;
    container.innerHTML = "";

    questions.forEach((q, index) => {
        shuffleArray(q.answers);
        const html = `
            <div class="question-container" id="qc-${index}">
                <div style="display:flex; justify-content:space-between; opacity:0.6; font-size:0.8rem;">
                    <span>${index + 1}/${questions.length}</span>
                    <span>ID: ${q.id}</span>
                </div>
                <div class="question-text" style="font-size:1.1rem; font-weight:bold; margin:10px 0;">
                    ${escapeHtml(q.question)}
                </div>
                <div class="choices">
                    ${q.answers.map(a => `
                        <button class="choice-btn" type="button" 
                                data-correct="${a.correct}" 
                                data-qidx="${index}">
                            ${escapeHtml(a.text)}
                        </button>
                    `).join("")}
                </div>
                <div class="hint-section" style="margin-top:10px;">
                    <button class="hint-btn" type="button" data-idx="${index}">Hinweis</button>
                    <span id="hint-text-${index}" style="margin-left:10px;"></span>
                </div>
                <div class="feedback" id="feedback-${index}"></div>
            </div>`;
        container.insertAdjacentHTML("beforeend", html);
    });

    bindInteractions();
}

function bindInteractions() {
    // Answer Buttons
    document.querySelectorAll(".choice-btn").forEach(btn => {
        btn.addEventListener("click", (e) => handleSelection(e.currentTarget));
    });

    // Hint Buttons (Pedagogical Scaffolding)
    document.querySelectorAll(".hint-btn").forEach(btn => {
        let clicks = 0;
        btn.addEventListener("click", () => {
            clicks++;
            const idx = btn.dataset.idx;
            const q = currentQuestions[idx];
            const span = document.getElementById(`hint-text-${idx}`);
            
            if (clicks === 1) span.innerHTML = `Genus: <b>${q.gender}</b>`;
            if (clicks === 2) {
                const color = COLORS[q.case] || COLORS.neutral;
                span.innerHTML += ` | Fall: <a href="#" class="case-link" style="color:${color}" data-fall="${q.case}">${q.case}</a>`;
            }
            if (clicks === 3) {
                span.innerHTML += ` | Translation: ${q.translations[selectedLanguage] || q.translations.en}`;
                btn.disabled = true;
                btn.style.opacity = 0.5;
            }
        });
    });

    // Case Links
    document.getElementById("questions-container").addEventListener("click", (e) => {
        if (e.target.classList.contains("case-link")) {
            e.preventDefault();
            openGrammarModal(e.target.dataset.fall);
        }
    });
}

function handleSelection(button) {
    const qIdx = Number(button.dataset.qidx);
    const isCorrect = button.dataset.correct === "true";
    const parent = button.closest(".question-container");

    // Disable buttons in this container
    parent.querySelectorAll(".choice-btn").forEach(b => {
        b.disabled = true;
        if (b !== button) b.style.opacity = "0.5";
    });

    button.classList.add("selected");
    button.style.backgroundColor = "#17a2b8";

    // Track answer
    userAnswers[qIdx] = { isCorrect, q: currentQuestions[qIdx], button };
    answeredQuestions++;

    if (answeredQuestions === currentQuestions.length) {
        setTimeout(revealResults, 500);
    }
}

function revealResults() {
    score = 0;
    // Metacognition stats
    const stats = { akkusativ: 0, dativ: 0, genitiv: 0, total: { akkusativ: 0, dativ: 0, genitiv: 0 } };

    userAnswers.forEach((ans, index) => {
        const feedback = document.getElementById(`feedback-${index}`);
        const hintText = document.getElementById(`hint-text-${index}`);
        const q = ans.q;

        stats.total[q.case]++;
        
        if (ans.isCorrect) {
            score++;
            stats[q.case]++;
            ans.button.style.backgroundColor = COLORS.akkusativ;
            feedback.innerHTML = `<span class="correct">Richtig! ${escapeHtml(q.explanation)}</span>`;
        } else {
            ans.button.style.backgroundColor = COLORS.genitiv;
            feedback.innerHTML = `<span class="incorrect">Falsch. ${escapeHtml(q.explanation)}</span>`;
        }

        // Show all hints automatically at end
        hintText.innerHTML = `Genus: ${q.gender} | Fall: ${q.case} | Translation: ${q.translations[selectedLanguage] || q.translations.en}`;
    });

    // Display score and performance breakdown
    document.getElementById("final-score").textContent = `Score: ${score} / ${currentQuestions.length}`;
    
    let breakdown = "Performance per case:<br>";
    for(let c in stats.total) {
        if(stats.total[c] > 0) breakdown += `${capitalize(c)}: ${stats[c]}/${stats.total[c]}<br>`;
    }
    document.getElementById("final-feedback").innerHTML = breakdown;
    document.getElementById("score-display").hidden = false;
    document.getElementById("try-again-button").hidden = false;
}

/* =========================
   5. Modal & Helpers
========================= */
function openGrammarModal(fallRaw) {
    const modal = document.getElementById("grammar-modal");
    const fall = fallRaw.toLowerCase();
    document.getElementById("modal-title").textContent = `${capitalize(fall)} Regeln`;
    document.getElementById("grammar-content").innerHTML = GRAMMAR_RULES[fall] || "No rules found.";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function wireModalCloseHandlers() {
    const modal = document.getElementById("grammar-modal");
    modal.addEventListener("click", (e) => {
        if (e.target.dataset.close || e.target === modal) {
            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        }
    });
}

function wireTryAgain() {
    document.getElementById("try-again-button").addEventListener("click", () => {
        score = 0;
        answeredQuestions = 0;
        userAnswers.length = 0;
        document.getElementById("score-display").hidden = true;
        loadAndStartQuiz();
    });
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
