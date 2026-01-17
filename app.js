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

  // 1) saved
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved && SUPPORTED_LANGS.includes(saved)) {
    selectedLanguage = saved;
    select.value = saved;
  } else {
    // 2) browser -> supported -> fallback en
    selectedLanguage = detectBrowserLang() || "en";
    select.value = selectedLanguage;
  }

  // persist changes
  select.addEventListener("change", (e) => {
    const val = e.target.value;
    selectedLanguage = val;
    localStorage.setItem(LANG_STORAGE_KEY, val);
  });
}

function detectBrowserLang() {
  const candidates = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || "en"];

  for (const lang of candidates) {
    const base = String(lang).toLowerCase().split("-")[0];
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
      const errors = validateData(data);
      if (errors.length) {
        showDataErrors(errors);
        return;
      }
      const selected = getRandomSubset(data, Math.min(QUESTIONS_PER_ROUND, data.length));
      displayAllQuestions(selected);
    })
    .catch((err) => {
      showDataErrors([`Failed to load data.json: ${String(err.message || err)}`]);
    });
}

/* =========================
   Validation
========================= */
function validateData(data) {
  const errors = [];
  if (!Array.isArray(data)) return ["data.json must be an array."];

  const ids = new Set();

  data.forEach((q, idx) => {
    const where = `Item #${idx + 1}${q && q.id != null ? ` (id=${q.id})` : ""}`;

    if (!q || typeof q !== "object") {
      errors.push(`${where}: must be an object.`);
      return;
    }

    if (q.id == null) errors.push(`${where}: missing 'id'.`);
    else if (ids.has(q.id)) errors.push(`${where}: duplicate id '${q.id}'.`);
    else ids.add(q.id);

    if (typeof q.question !== "string" || !q.question.trim()) errors.push(`${where}: missing/invalid 'question'.`);
    if (typeof q.explanation !== "string" || !q.explanation.trim()) errors.push(`${where}: missing/invalid 'explanation'.`);

    if (typeof q.case !== "string" || !q.case.trim()) errors.push(`${where}: missing/invalid 'case'.`);
    if (typeof q.gender !== "string" || !q.gender.trim()) errors.push(`${where}: missing/invalid 'gender'.`);

    if (!q.translations || typeof q.translations !== "object") {
      errors.push(`${where}: missing/invalid 'translations'.`);
    } else if (!q.translations.en) {
      errors.push(`${where}: translations.en is required.`);
    }

    if (!Array.isArray(q.answers) || q.answers.length < 2) {
      errors.push(`${where}: answers must be an array (>=2).`);
    } else {
      const correctCount = q.answers.filter(a => a && a.correct === true).length;
      if (correctCount !== 1) errors.push(`${where}: answers must have exactly 1 correct=true (found ${correctCount}).`);

      q.answers.forEach((a, aIdx) => {
        if (!a || typeof a !== "object") errors.push(`${where}: answer[${aIdx}] must be an object.`);
        else {
          if (typeof a.text !== "string" || !a.text.trim()) errors.push(`${where}: answer[${aIdx}].text missing/invalid.`);
          if (typeof a.correct !== "boolean") errors.push(`${where}: answer[${aIdx}].correct must be boolean.`);
        }
      });
    }
  });

  return errors;
}

function showDataErrors(errors) {
  const container = document.getElementById("questions-container");
  if (!container) return;

  container.innerHTML = `
    <div class="question-container">
      <strong>Quiz could not start.</strong>
      <p>Fix <code>data.json</code> or <code>app.js</code>:</p>
      <pre style="text-align:left; white-space:pre-wrap;">${escapeHtml(errors.join("\n"))}</pre>
    </div>
  `;
}

/* =========================
   Rendering
========================= */
function displayAllQuestions(questions) {
  const container = document.getElementById("questions-container");
  container.innerHTML = "";

  questions.forEach((question, index) => {
    shuffleArray(question.answers);

    // NEW: card header with number + total + id
    const headerLine = `
      <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:8px; font-size:0.95rem; opacity:0.85;">
        <span><strong>${index + 1}/${questions.length}</strong></span>
        <span>ID: <strong>${escapeHtml(String(question.id))}</strong></span>
      </div>
    `;

    const html = `
      <div class="question-container" data-qid="${escapeHtml(String(question.id))}">
        ${headerLine}
        <strong>${escapeHtml(question.question)}</strong>
        <div class="choices">
          ${question.answers.map(answer => `
            <button class="choice-btn" data-correct="${answer.correct}" data-index="${index}">
              ${escapeHtml(answer.text)}
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

  // answer buttons
  container.querySelectorAll(".choice-btn").forEach(btn => {
    btn.addEventListener("click", (e) => handleAnswerSelection(e.target, questions));
  });

  // hint buttons (always available; ONLY disabled after 3 clicks)
  questions.forEach((_, index) => {
    const hintButton = document.getElementById(`hint-btn-${index}`);
    let hintClicks = 0;

    hintButton.addEventListener("click", () => {
      hintClicks++;

      const hintTextEl = document.getElementById(`hint-text-${index}`);

      if (hintClicks === 1) {
        hintTextEl.textContent = `Geschlecht: ${questions[index].gender}`;
      } else if (hintClicks === 2) {
        hintTextEl.textContent += ` | Fall: ${questions[index].case}`;
      } else if (hintClicks === 3) {
        const t = getTranslation(questions[index]);
        hintTextEl.textContent += ` | Übersetzung: ${t}`;
        hintButton.disabled = true;
        hintButton.style.opacity = 0.5;
      }
    });
  });
}

function getTranslation(q) {
  const tr = q.translations || {};
  return tr[selectedLanguage] || tr.en || "";
}

/* =========================
   Interaction / Results
========================= */
function handleAnswerSelection(button, questions) {
  const isCorrect = button.getAttribute("data-correct") === "true";
  const questionIndex = Number(button.getAttribute("data-index"));

  const parent = button.closest(".question-container");
  const buttons = parent.querySelectorAll(".choice-btn");

  // CHANGED: do NOT disable hint after answer
  // (Hint button remains clickable until user uses 3 hints)
  // const hintBtn = document.getElementById(`hint-btn-${questionIndex}`);
  // hintBtn.disabled = true;
  // hintBtn.style.opacity = 0.5;

  userAnswers[questionIndex] = { selectedButton: button, isCorrect, question: questions[questionIndex] };

  button.classList.add("selected");
  button.style.backgroundColor = "#17a2b8";

  buttons.forEach(b => {
    b.disabled = true;
    if (b !== button) b.style.backgroundColor = "#ccc";
  });

  answeredQuestions++;
  if (answeredQuestions === questions.length) {
    setTimeout(() => {
      revealResults();
      enableTryAgainButton();
    }, 500);
  }
}

function revealResults() {
  score = 0;

  userAnswers.forEach((answer, index) => {
    const selectedButton = answer.selectedButton;
    const feedbackElement = document.getElementById(`feedback-${index}`);

    const correctButton = Array.from(selectedButton.parentNode.children)
      .find(b => b.getAttribute("data-correct") === "true");

    if (answer.isCorrect) {
      score++;
      selectedButton.style.backgroundColor = "#28a745";
      feedbackElement.innerHTML = `<span class="correct">Richtig! 🎉 ${escapeHtml(answer.question.explanation)}</span>`;
    } else {
      selectedButton.style.backgroundColor = "#dc3545";
      if (correctButton) correctButton.style.backgroundColor = "#28a745";

      feedbackElement.innerHTML = `
        <span class="incorrect">Falsch! 😢 ${escapeHtml(answer.question.explanation)}</span>
        <br><strong>Übersetzung:</strong> ${escapeHtml(getTranslation(answer.question))}
      `;
    }
  });

  // NEW: After test ends, show all hints automatically
  showAllHintsAfterFinish();

  document.getElementById("final-score").textContent = `Ihre Punktzahl: ${score} / ${userAnswers.length}`;
  document.getElementById("final-feedback").textContent =
    "Alle Hinweise wurden angezeigt. Scrollen Sie nach oben, um alles zu überprüfen.";
  document.getElementById("score-display").style.display = "block";
}

function showAllHintsAfterFinish() {
  userAnswers.forEach((ans, index) => {
    const q = ans.question;

    const hintTextEl = document.getElementById(`hint-text-${index}`);
    const hintBtn = document.getElementById(`hint-btn-${index}`);

    if (!hintTextEl) return;

    hintTextEl.textContent =
      `Geschlecht: ${q.gender} | Fall: ${q.case} | Übersetzung: ${getTranslation(q)}`;

    // disable hint button because everything is shown now
    if (hintBtn) {
      hintBtn.disabled = true;
      hintBtn.style.opacity = 0.5;
    }
  });
}

function wireTryAgain() {
  const btn = document.getElementById("try-again-button");
  btn.addEventListener("click", resetQuiz);
}

function resetQuiz() {
  document.getElementById("questions-container").innerHTML = "";
  document.getElementById("final-score").textContent = "";
  document.getElementById("final-feedback").textContent = "";
  document.getElementById("score-display").style.display = "none";

  score = 0;
  answeredQuestions = 0;
  userAnswers.length = 0;

  const tryAgainButton = document.getElementById("try-again-button");
  tryAgainButton.style.display = "none";
  tryAgainButton.classList.remove("visible");

  loadAndStartQuiz();
}

function enableTryAgainButton() {
  const tryAgainButton = document.getElementById("try-again-button");
  tryAgainButton.style.display = "block";

  if (scrollListenerAdded) return;
  scrollListenerAdded = true;

  window.addEventListener("scroll", () => {
    if (window.scrollY < 100) tryAgainButton.classList.add("visible");
    else tryAgainButton.classList.remove("visible");
  });
}

/* =========================
   Utils
========================= */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getRandomSubset(array, n) {
  const shuffled = [...array];
  shuffleArray(shuffled);
  return shuffled.slice(0, n);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
