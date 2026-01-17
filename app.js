"use strict";

/* =========================
   Config
========================= */
const QUESTIONS_PER_ROUND = 10;
const SUPPORTED_LANGS = ["en", "uk", "ro", "ar"];
const LANG_STORAGE_KEY = "adjQuizLang";

/* =========================
   State
========================= */
let selectedLanguage = "en";
let score = 0;
let answeredQuestions = 0;
const userAnswers = [];
let scrollListenerAdded = false;

/* =========================
   Grammar popup (Fall rules)
========================= */
let grammarDialog;

const GRAMMAR_RULES = {
  Akkusativ: `
    <table border="1" cellpadding="6">
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>den + -en</td><td>die + -e</td><td>das + -e</td><td>die + -en</td></tr>
      <tr><td>Unbestimmt</td><td>einen + -en</td><td>eine + -e</td><td>ein + -es</td><td>– + -en</td></tr>
      <tr><td>Possessiv / kein</td><td>meinen + -en</td><td>meine + -e</td><td>mein + -es</td><td>meine + -en</td></tr>
    </table>
  `,
  Dativ: `
    <table border="1" cellpadding="6">
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Alle</td><td>dem + -en</td><td>der + -en</td><td>dem + -en</td><td>den + -en (+n)</td></tr>
    </table>
  `,
  Genitiv: `
    <table border="1" cellpadding="6">
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>des + -en</td><td>der + -en</td><td>des + -en</td><td>der + -en</td></tr>
    </table>
  `
};

function ensureGrammarDialog() {
  if (grammarDialog) return;

  grammarDialog = document.createElement("dialog");
  grammarDialog.innerHTML = `
    <div style="font-size:1rem; line-height:1.4">
      <h3 id="grammar-title"></h3>
      <div id="grammar-content"></div>
      <button id="grammar-close" style="margin-top:12px;">OK</button>
    </div>
  `;
  document.body.appendChild(grammarDialog);

  document.getElementById("grammar-close")
    .addEventListener("click", () => grammarDialog.close());
}

/* =========================
   Boot
========================= */
document.addEventListener("DOMContentLoaded", () => {
  initLanguageUI();
  loadAndStartQuiz();
  wireTryAgain();
});

/* =========================
   Language
========================= */
function initLanguageUI() {
  const select = document.getElementById("language-select");
  if (!select) return;

  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved && SUPPORTED_LANGS.includes(saved)) {
    selectedLanguage = saved;
    select.value = saved;
  } else {
    selectedLanguage = detectBrowserLang() || "en";
    select.value = selectedLanguage;
  }

  select.addEventListener("change", (e) => {
    selectedLanguage = e.target.value;
    localStorage.setItem(LANG_STORAGE_KEY, selectedLanguage);
  });
}

function detectBrowserLang() {
  const langs = navigator.languages || [navigator.language || "en"];
  for (const l of langs) {
    const base = l.toLowerCase().split("-")[0];
    if (SUPPORTED_LANGS.includes(base)) return base;
  }
  return null;
}

/* =========================
   Data loading
========================= */
function loadAndStartQuiz() {
  fetch("data.json", { cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      const selected = getRandomSubset(data, Math.min(QUESTIONS_PER_ROUND, data.length));
      displayAllQuestions(selected);
    });
}

/* =========================
   Rendering
========================= */
function displayAllQuestions(questions) {
  const container = document.getElementById("questions-container");
  container.innerHTML = "";
  ensureGrammarDialog();

  questions.forEach((q, index) => {
    shuffleArray(q.answers);

    const html = `
      <div class="question-container">
        <div style="display:flex; justify-content:space-between; opacity:.85; margin-bottom:8px;">
          <span><strong>${index + 1}/${questions.length}</strong></span>
          <span>ID: <strong>${q.id}</strong></span>
        </div>

        <strong>${escapeHtml(q.question)}</strong>

        <div class="choices">
          ${q.answers.map(a => `
            <button class="choice-btn" data-correct="${a.correct}" data-index="${index}">
              ${escapeHtml(a.text)}
            </button>
          `).join("")}
        </div>

        <div class="hint-section">
          <button class="hint-btn" id="hint-btn-${index}">Hinweis</button>
          <span id="hint-text-${index}" style="margin-left:10px; font-size:1.1rem;"></span>
        </div>

        <div class="feedback" id="feedback-${index}"></div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", html);
  });

  container.querySelectorAll(".choice-btn").forEach(btn => {
    btn.addEventListener("click", e => handleAnswerSelection(e.target, questions));
  });

  questions.forEach((_, index) => {
    const hintBtn = document.getElementById(`hint-btn-${index}`);
    let clicks = 0;

    hintBtn.addEventListener("click", () => {
      clicks++;
      const el = document.getElementById(`hint-text-${index}`);

      if (clicks === 1) {
        el.textContent = `Geschlecht: ${questions[index].gender}`;
      } else if (clicks === 2) {
        const fall = questions[index].case;
        el.innerHTML += ` | Fall: <span class="case-link" data-fall="${fall}" style="color:#1d4ed8; text-decoration:underline; cursor:pointer;">${fall}</span>`;
      } else if (clicks === 3) {
        el.innerHTML += ` | Übersetzung: ${getTranslation(questions[index])}`;
        hintBtn.disabled = true;
        hintBtn.style.opacity = 0.5;
      }
    });
  });

  container.addEventListener("click", (e) => {
    const link = e.target.closest(".case-link");
    if (!link) return;

    const fall = link.dataset.fall;
    document.getElementById("grammar-title").textContent = `${fall} – Regeln`;
    document.getElementById("grammar-content").innerHTML = GRAMMAR_RULES[fall] || "Keine Regeln verfügbar";
    grammarDialog.showModal();
  });
}

/* =========================
   Interaction / Results
========================= */
function handleAnswerSelection(button, questions) {
  const index = Number(button.dataset.index);
  const isCorrect = button.dataset.correct === "true";

  const parent = button.closest(".question-container");
  parent.querySelectorAll(".choice-btn").forEach(b => {
    b.disabled = true;
    if (b !== button) b.style.backgroundColor = "#ccc";
  });

  userAnswers[index] = { selectedButton: button, isCorrect, question: questions[index] };

  answeredQuestions++;
  button.style.backgroundColor = "#17a2b8";

  if (answeredQuestions === questions.length) {
    setTimeout(() => {
      revealResults();
      enableTryAgainButton();
    }, 400);
  }
}

function revealResults() {
  score = 0;

  userAnswers.forEach((ans, index) => {
    const fb = document.getElementById(`feedback-${index}`);
    const buttons = ans.selectedButton.parentNode.querySelectorAll(".choice-btn");
    const correctBtn = [...buttons].find(b => b.dataset.correct === "true");

    if (ans.isCorrect) {
      score++;
      ans.selectedButton.style.backgroundColor = "#28a745";
      fb.innerHTML = `<span class="correct">Richtig! 🎉 ${escapeHtml(ans.question.explanation)}</span>`;
    } else {
      ans.selectedButton.style.backgroundColor = "#dc3545";
      if (correctBtn) correctBtn.style.backgroundColor = "#28a745";
      fb.innerHTML = `<span class="incorrect">Falsch! 😢 ${escapeHtml(ans.question.explanation)}</span>`;
    }
  });

  showAllHintsAfterFinish();

  document.getElementById("final-score").textContent = `Ihre Punktzahl: ${score} / ${userAnswers.length}`;
  document.getElementById("score-display").hidden = false;
}

function showAllHintsAfterFinish() {
  userAnswers.forEach((ans, index) => {
    const q = ans.question;
    const el = document.getElementById(`hint-text-${index}`);
    if (!el) return;

    el.innerHTML =
      `Geschlecht: ${q.gender} | Fall: <span class="case-link" data-fall="${q.case}" style="color:#1d4ed8; text-decoration:underline; cursor:pointer;">${q.case}</span> | Übersetzung: ${getTranslation(q)}`;
  });
}

function wireTryAgain() {
  document.getElementById("try-again-button")
    .addEventListener("click", resetQuiz);
}

function resetQuiz() {
  document.getElementById("questions-container").innerHTML = "";
  document.getElementById("score-display").hidden = true;
  document.getElementById("try-again-button").hidden = true;

  score = 0;
  answeredQuestions = 0;
  userAnswers.length = 0;

  loadAndStartQuiz();
}

function enableTryAgainButton() {
  const btn = document.getElementById("try-again-button");
  btn.hidden = false;

  if (scrollListenerAdded) return;
  scrollListenerAdded = true;

  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY < 100);
  });
}

/* =========================
   Utils
========================= */
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

function getTranslation(q) {
  return q.translations?.[selectedLanguage] || q.translations?.en || "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
