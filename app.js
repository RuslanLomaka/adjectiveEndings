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
   Grammar modal (Fall rules)
   Uses the existing HTML modal:
   #grammar-modal, #modal-title, #grammar-content
========================= */
const GRAMMAR_RULES = {
  akkusativ: `
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>den + <b>-en</b></td><td>die + <b>-e</b></td><td>das + <b>-e</b></td><td>die + <b>-en</b></td></tr>
      <tr><td>Unbestimmt</td><td>einen + <b>-en</b></td><td>eine + <b>-e</b></td><td>ein + <b>-es</b></td><td>(keine) + <b>-en</b></td></tr>
      <tr><td>Possessiv / kein</td><td>meinen/keinen + <b>-en</b></td><td>meine/keine + <b>-e</b></td><td>mein/kein + <b>-es</b></td><td>meine/keine + <b>-en</b></td></tr>
    </table>
  `,
  dativ: `
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>dem + <b>-en</b></td><td>der + <b>-en</b></td><td>dem + <b>-en</b></td><td>den + <b>-en</b> (+n am Nomen)</td></tr>
      <tr><td>Unbestimmt</td><td>einem + <b>-en</b></td><td>einer + <b>-en</b></td><td>einem + <b>-en</b></td><td>(keine) + <b>-en</b> (+n am Nomen)</td></tr>
      <tr><td>Possessiv / kein</td><td>meinem/keinem + <b>-en</b></td><td>meiner/keiner + <b>-en</b></td><td>meinem/keinem + <b>-en</b></td><td>meinen/keinen + <b>-en</b> (+n am Nomen)</td></tr>
    </table>
  `,
  genitiv: `
    <table>
      <tr><th></th><th>Mask.</th><th>Fem.</th><th>Neutr.</th><th>Plural</th></tr>
      <tr><td>Bestimmt</td><td>des + <b>-en</b></td><td>der + <b>-en</b></td><td>des + <b>-en</b></td><td>der + <b>-en</b></td></tr>
      <tr><td>Unbestimmt</td><td>eines + <b>-en</b></td><td>einer + <b>-en</b></td><td>eines + <b>-en</b></td><td>(keine) + <b>-en</b></td></tr>
      <tr><td>Possessiv / kein</td><td>meines/keines + <b>-en</b></td><td>meiner/keiner + <b>-en</b></td><td>meines/keines + <b>-en</b></td><td>meiner/keiner + <b>-en</b></td></tr>
    </table>
  `,
};

function getModalEls() {
  return {
    modal: document.getElementById("grammar-modal"),
    title: document.getElementById("modal-title"),
    content: document.getElementById("grammar-content"),
  };
}

function openGrammarModal(fallRaw) {
  const { modal, title, content } = getModalEls();
  if (!modal || !title || !content) return;

  const fall = normalizeFall(fallRaw);
  title.textContent = `${capitalize(fall)} – Regeln`;
  content.innerHTML = GRAMMAR_RULES[fall] || `<p><b>Keine Regeln verfügbar.</b></p>`;

  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeGrammarModal() {
  const { modal } = getModalEls();
  if (!modal) return;

  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function wireModalCloseHandlers() {
  const { modal } = getModalEls();
  if (!modal) return;

  // close on buttons/backdrop
  modal.addEventListener("click", (e) => {
    const close = e.target.closest("[data-close='1']");
    if (!close) return;
    closeGrammarModal();
  });

  // close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const isOpen = modal.getAttribute("aria-hidden") === "false";
    if (isOpen) closeGrammarModal();
  });
}

/* =========================
   Boot
========================= */
document.addEventListener("DOMContentLoaded", () => {
  initLanguageUI();
  wireModalCloseHandlers();
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
  const langs = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || "en"];

  for (const l of langs) {
    const base = String(l).toLowerCase().split("-")[0];
    if (SUPPORTED_LANGS.includes(base)) return base;
  }
  return null;
}

/* =========================
   Data loading
========================= */
function loadAndStartQuiz() {
  fetch("data.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`data.json HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const selected = getRandomSubset(data, Math.min(QUESTIONS_PER_ROUND, data.length));
      displayAllQuestions(selected);
    })
    .catch((err) => {
      const container = document.getElementById("questions-container");
      if (!container) return;
      container.innerHTML = `
        <div class="question-container">
          <strong>Quiz could not start.</strong>
          <p>${escapeHtml(String(err.message || err))}</p>
        </div>
      `;
    });
}

/* =========================
   Rendering
========================= */
function displayAllQuestions(questions) {
  const container = document.getElementById("questions-container");
  if (!container) return;

  container.innerHTML = "";

  questions.forEach((q, index) => {
    shuffleArray(q.answers);

    const headerLine = `
      <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:8px; font-size:0.95rem; opacity:0.85;">
        <span><strong>${index + 1}/${questions.length}</strong></span>
        <span>ID: <strong>${escapeHtml(String(q.id))}</strong></span>
      </div>
    `;

    const html = `
      <div class="question-container" data-index="${index}">
        ${headerLine}

        <div class="question-text" style="font-size:1.15rem; font-weight:700; margin-bottom:10px;">
          ${escapeHtml(q.question)}
        </div>

        <div class="choices">
          ${q.answers.map(a => `
            <button class="choice-btn" type="button" data-correct="${a.correct}" data-index="${index}">
              ${escapeHtml(a.text)}
            </button>
          `).join("")}
        </div>

        <div class="hint-section" style="margin-top:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button class="hint-btn" type="button" id="hint-btn-${index}">Hinweis</button>
          <span id="hint-text-${index}" style="font-size:1.05rem;"></span>
        </div>

        <div class="feedback" id="feedback-${index}"></div>
      </div>
    `;

    container.insertAdjacentHTML("beforeend", html);
  });

  // answer buttons
  container.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => handleAnswerSelection(e.currentTarget, questions));
  });

  // hint buttons (always available; disabled only after translation shown)
  questions.forEach((_, index) => {
    const hintBtn = document.getElementById(`hint-btn-${index}`);
    let clicks = 0;

    hintBtn.addEventListener("click", () => {
      clicks++;
      const el = document.getElementById(`hint-text-${index}`);
      const q = questions[index];

      if (clicks === 1) {
        el.textContent = `Geschlecht: ${q.gender}`;
      } else if (clicks === 2) {
        el.insertAdjacentHTML("beforeend", ` | Fall: ${renderFallLink(q.case)}`);
      } else if (clicks === 3) {
        el.insertAdjacentHTML("beforeend", ` | Übersetzung: ${escapeHtml(getTranslation(q))}`);
        hintBtn.disabled = true;
        hintBtn.style.opacity = 0.5;
      }
    });
  });

  // clicking Fall link opens modal
  container.addEventListener("click", (e) => {
    const link = e.target.closest(".case-link");
    if (!link) return;
    e.preventDefault();
    openGrammarModal(link.dataset.fall);
  });
}

function renderFallLink(fallRaw) {
  const fall = escapeHtml(String(fallRaw || ""));
  return `<a class="case-link" href="#" data-fall="${fall}">${fall}</a>`;
}

function getTranslation(q) {
  const tr = q.translations || {};
  return tr[selectedLanguage] || tr.en || "";
}

/* =========================
   Interaction / Results
========================= */
function handleAnswerSelection(button, questions) {
  const questionIndex = Number(button.dataset.index);
  const isCorrect = button.dataset.correct === "true";

  const parent = button.closest(".question-container");
  const buttons = parent.querySelectorAll(".choice-btn");

  // disable answers
  buttons.forEach((b) => {
    b.disabled = true;
    if (b !== button) b.style.backgroundColor = "#ccc";
  });

  userAnswers[questionIndex] = { selectedButton: button, isCorrect, question: questions[questionIndex] };

  answeredQuestions++;
  button.classList.add("selected");
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
    const feedback = document.getElementById(`feedback-${index}`);
    const selectedBtn = ans.selectedButton;
    const allBtns = selectedBtn.parentNode.querySelectorAll(".choice-btn");
    const correctBtn = [...allBtns].find((b) => b.dataset.correct === "true");

    if (ans.isCorrect) {
      score++;
      selectedBtn.style.backgroundColor = "#28a745";
      feedback.innerHTML = `<span class="correct">Richtig! 🎉 ${escapeHtml(ans.question.explanation)}</span>`;
    } else {
      selectedBtn.style.backgroundColor = "#dc3545";
      if (correctBtn) correctBtn.style.backgroundColor = "#28a745";
      feedback.innerHTML = `<span class="incorrect">Falsch! 😢 ${escapeHtml(ans.question.explanation)}</span>`;
    }
  });

  // after test ends show full hints (gender + clickable fall + translation)
  showAllHintsAfterFinish();

  const scoreEl = document.getElementById("final-score");
  const feedbackEl = document.getElementById("final-feedback");
  const box = document.getElementById("score-display");

  if (scoreEl) scoreEl.textContent = `Ihre Punktzahl: ${score} / ${userAnswers.length}`;
  if (feedbackEl) feedbackEl.textContent = "Alle Hinweise sind jetzt sichtbar. Klicken Sie auf „Fall“ für die Regeln.";
  if (box) box.hidden = false;
}

function showAllHintsAfterFinish() {
  userAnswers.forEach((ans, index) => {
    const q = ans.question;
    const el = document.getElementById(`hint-text-${index}`);
    const hintBtn = document.getElementById(`hint-btn-${index}`);
    if (!el) return;

    el.innerHTML =
      `Geschlecht: ${escapeHtml(q.gender)} | Fall: ${renderFallLink(q.case)} | Übersetzung: ${escapeHtml(getTranslation(q))}`;

    if (hintBtn) {
      hintBtn.disabled = true;
      hintBtn.style.opacity = 0.5;
    }
  });
}

/* =========================
   Try again
========================= */
function wireTryAgain() {
  const btn = document.getElementById("try-again-button");
  if (!btn) return;
  btn.addEventListener("click", resetQuiz);
}

function resetQuiz() {
  const container = document.getElementById("questions-container");
  const scoreBox = document.getElementById("score-display");
  const tryAgain = document.getElementById("try-again-button");
  const finalScore = document.getElementById("final-score");
  const finalFeedback = document.getElementById("final-feedback");

  if (container) container.innerHTML = "";
  if (scoreBox) scoreBox.hidden = true;
  if (finalScore) finalScore.textContent = "";
  if (finalFeedback) finalFeedback.textContent = "";

  score = 0;
  answeredQuestions = 0;
  userAnswers.length = 0;

  if (tryAgain) {
    tryAgain.hidden = true;
    tryAgain.classList.remove("visible");
  }

  closeGrammarModal();
  loadAndStartQuiz();
}

function enableTryAgainButton() {
  const btn = document.getElementById("try-again-button");
  if (!btn) return;

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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeFall(fallRaw) {
  return String(fallRaw || "").trim().toLowerCase();
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
