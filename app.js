  // --- Config ---
  const QUESTIONS_PER_ROUND = 10;
  const SUPPORTED_LANGS = ["en", "uk", "ro", "ar"];
  const LANG_STORAGE_KEY = "adjQuizLang";

  // --- State ---
  let selectedLanguage = "en";
  let score = 0;
  let answeredQuestions = 0;
  const userAnswers = [];

  // --- Language init (saved -> browser -> en) ---
  initLanguage();

  function initLanguage() (function() {
    const select = document.getElementById("language-select");

    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) {
      selectedLanguage = saved;
      select.value = saved;
      return;
    }

    const browserCandidates = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || "en"];

    const normalized = browserCandidates
      .map(l => String(l).toLowerCase().split("-")[0]); // "en-US" -> "en"

    const match = normalized.find(l => SUPPORTED_LANGS.includes(l));
    selectedLanguage = match || "en";
    select.value = selectedLanguage;
  })();

  // Persist language choice (no live re-render needed)
  document.getElementById("language-select").addEventListener("change", (event) => {
    const val = event.target.value;
    selectedLanguage = val;
    localStorage.setItem(LANG_STORAGE_KEY, val);
  });

  // --- Load + validate + render ---
  fetch("data.json", { cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      const errors = validateData(data);
      if (errors.length) {
        showDataErrors(errors);
        return;
      }
      const selectedQuestions = getRandomSubset(data, Math.min(QUESTIONS_PER_ROUND, data.length));
      displayAllQuestions(selectedQuestions);
    })
    .catch(error => console.error("Fehler beim Laden der JSON-Daten:", error));

  function validateData(data) {
    const errors = [];
    if (!Array.isArray(data)) {
      return ["data.json must be an array of questions."];
    }

    const ids = new Set();

    data.forEach((q, idx) => {
      const path = `Item #${idx + 1}${q && q.id != null ? ` (id=${q.id})` : ""}`;

      if (!q || typeof q !== "object") {
        errors.push(`${path}: must be an object.`);
        return;
      }

      if (q.id == null) errors.push(`${path}: missing 'id'.`);
      else if (ids.has(q.id)) errors.push(`${path}: duplicate id '${q.id}'.`);
      else ids.add(q.id);

      if (!q.question || typeof q.question !== "string") errors.push(`${path}: missing/invalid 'question'.`);
      if (!q.explanation || typeof q.explanation !== "string") errors.push(`${path}: missing/invalid 'explanation'.`);

      if (!q.case || typeof q.case !== "string") errors.push(`${path}: missing/invalid 'case'.`);
      if (!q.gender || typeof q.gender !== "string") errors.push(`${path}: missing/invalid 'gender'.`);

      if (!q.translations || typeof q.translations !== "object") {
        errors.push(`${path}: missing/invalid 'translations'.`);
      } else if (!q.translations.en) {
        errors.push(`${path}: translations.en is required (fallback language).`);
      }

      if (!Array.isArray(q.answers) || q.answers.length < 2) {
        errors.push(`${path}: 'answers' must be an array with at least 2 items.`);
      } else {
        const correctCount = q.answers.filter(a => a && a.correct === true).length;
        if (correctCount !== 1) errors.push(`${path}: answers must have exactly 1 correct=true (found ${correctCount}).`);
        q.answers.forEach((a, aIdx) => {
          if (!a || typeof a !== "object") errors.push(`${path}: answer[${aIdx}] must be an object.`);
          else if (typeof a.text !== "string" || !a.text.trim()) errors.push(`${path}: answer[${aIdx}].text missing/invalid.`);
          else if (typeof a.correct !== "boolean") errors.push(`${path}: answer[${aIdx}].correct must be boolean.`);
        });
      }
    });

    return errors;
  }

  function showDataErrors(errors) {
    const container = document.getElementById("questions-container");
    container.innerHTML = `
      <div class="question-container">
        <strong>Data validation failed.</strong>
        <p>Please fix <code>data.json</code>:</p>
        <pre style="text-align:left; white-space:pre-wrap;">${escapeHtml(errors.join("\n"))}</pre>
      </div>
    `;
  }

  function displayAllQuestions(questions) {
    const container = document.getElementById("questions-container");

    questions.forEach((question, index) => {
      shuffleArray(question.answers);

      const questionHTML = `
        <div class="question-container">
          <strong>${escapeHtml(question.question)}</strong>
          <div class="choices">
            ${question.answers.map((answer) => `
              <button class="choice-btn" data-correct="${answer.correct}" data-index="${index}">
                ${escapeHtml(answer.text)}
              </button>
            `).join("")}
          </div>
          <div class="hint-section">
            <button class="hint-btn" id="hint-btn-${index}">Hinweis</button>
            <span id="hint-text-${index}" style="margin-left: 10px; font-size: 1.1rem;"></span>
          </div>
          <div class="feedback" id="feedback-${index}"></div>
        </div>
      `;
      container.innerHTML += questionHTML;
    });

    const buttons = document.querySelectorAll(".choice-btn");
    buttons.forEach(button => {
      button.addEventListener("click", (e) => handleAnswerSelection(e.target, questions));
    });

    // Hint buttons
    questions.forEach((_, index) => {
      const hintButton = document.getElementById(`hint-btn-${index}`);
      let hintClicks = 0;

      hintButton.addEventListener("click", () => {
        hintClicks++;

        if (hintClicks === 1) {
          document.getElementById(`hint-text-${index}`).textContent =
            `Geschlecht: ${questions[index].gender}`;
        } else if (hintClicks === 2) {
          document.getElementById(`hint-text-${index}`).textContent +=
            ` | Fall: ${questions[index].case}`;
        } else if (hintClicks === 3) {
          const t = (questions[index].translations && (questions[index].translations[selectedLanguage] || questions[index].translations.en)) || "";
          document.getElementById(`hint-text-${index}`).textContent +=
            ` | Übersetzung: ${t}`;
          hintButton.disabled = true;
          hintButton.style.opacity = 0.5;
        }
      });
    });
  }

  function handleAnswerSelection(button, questions) {
    const isCorrect = button.getAttribute("data-correct") === "true";
    const questionIndex = button.getAttribute("data-index");
    const parentContainer = button.closest(".question-container");
    const buttons = parentContainer.querySelectorAll(".choice-btn");

    // Disable hint after answer
    const hintBtn = document.getElementById(`hint-btn-${questionIndex}`);
    hintBtn.disabled = true;
    hintBtn.style.opacity = 0.5;

    userAnswers[questionIndex] = {
      selectedButton: button,
      isCorrect: isCorrect,
      question: questions[questionIndex]
    };

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
      }, 1000);
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
        correctButton.style.backgroundColor = "#28a745";
        const t = (answer.question.translations && (answer.question.translations[selectedLanguage] || answer.question.translations.en)) || "";
        feedbackElement.innerHTML = `
          <span class="incorrect">Falsch! 😢 ${escapeHtml(answer.question.explanation)}</span>
          <br><strong>Übersetzung:</strong> ${escapeHtml(t)}
        `;
      }
    });

    document.getElementById("final-score").textContent = `Ihre Punktzahl: ${score} / ${userAnswers.length}`;
    document.getElementById("final-feedback").textContent =
      "Scrollen Sie nach oben, um die Übersetzungen und Erklärungen zu sehen!";
    document.getElementById("score-display").style.display = "block";
  }

  document.getElementById("try-again-button").addEventListener("click", resetQuiz);

  function resetQuiz() {
    document.getElementById("questions-container").innerHTML = "";
    document.getElementById("final-score").textContent = "";
    document.getElementById("final-feedback").textContent = "";
    document.getElementById("score-display").style.display = "none";

    score = 0;
    answeredQuestions = 0;
    userAnswers.length = 0;

    // Hide Try Again until finished
    const tryAgainButton = document.getElementById("try-again-button");
    tryAgainButton.style.display = "none";
    tryAgainButton.classList.remove("visible");

    fetch("data.json", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        const errors = validateData(data);
        if (errors.length) {
          showDataErrors(errors);
          return;
        }
        const selectedQuestions = getRandomSubset(data, Math.min(QUESTIONS_PER_ROUND, data.length));
        displayAllQuestions(selectedQuestions);
      })
      .catch(error => console.error("Fehler beim Laden der JSON-Daten:", error));
  }

  function enableTryAgainButton() {
    const tryAgainButton = document.getElementById("try-again-button");
    tryAgainButton.style.display = "block";

    // NOTE: this adds a scroll listener each round in your original code.
    // If you want, we can make it add only once, but leaving behavior intact.
    window.addEventListener("scroll", () => {
      reminder: if (window.scrollY < 100) {
        tryAgainButton.classList.add("visible");
      } else {
        tryAgainButton.classList.remove("visible");
      }
    });
  }

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

