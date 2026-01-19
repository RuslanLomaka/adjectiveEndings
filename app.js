"use strict";

const QUESTIONS_PER_ROUND = 10;
let selectedLanguage = localStorage.getItem("adjQuizLang") || "en";
let currentQuestions = [];
let answeredCount = 0;
let score = 0;

const COLORS = { akkusativ: "#28a745", dativ: "#007bff", genitiv: "#dc3545" };

document.addEventListener("DOMContentLoaded", () => {
    const langSelect = document.getElementById("language-select");
    langSelect.value = selectedLanguage;
    langSelect.onchange = (e) => {
        selectedLanguage = e.target.value;
        localStorage.setItem("adjQuizLang", selectedLanguage);
    };

    fetch("data.json")
        .then(r => r.json())
        .then(data => {
            currentQuestions = data.sort(() => 0.5 - Math.random()).slice(0, QUESTIONS_PER_ROUND);
            renderQuiz();
        });

    // Close modal logic
    document.addEventListener("click", e => {
        if (e.target.dataset.close) document.getElementById("grammar-modal").setAttribute("aria-hidden", "true");
    });
});

function renderQuiz() {
    const container = document.getElementById("questions-container");
    container.innerHTML = currentQuestions.map((q, idx) => `
        <div class="question-card" id="card-${idx}">
          <div class="card-meta">Frage ID: ${q.id}</div>
          <div class="question-text">${q.question}</div>
          <div class="choices" id="choices-${idx}">
            ${q.answers.map(a => `<button class="btn-choice" onclick="checkAnswer(${idx}, ${a.correct}, this)">${a.text}</button>`).join('')}
          </div>
          <div class="hint-zone">
            <button class="btn-hint" onclick="provideHint(${idx}, this)">Hinweis</button>
            <span id="hint-text-${idx}" class="hint-display"></span>
          </div>
          <div id="feedback-${idx}" class="feedback-text"></div>
        </div>
    `).join('');
}

function provideHint(idx, btn) {
    const q = currentQuestions[idx];
    const span = document.getElementById(`hint-text-${idx}`);
    let step = parseInt(btn.dataset.step || "0") + 1;
    btn.dataset.step = step;

    if (step === 1) span.innerHTML = `Genus: <b>${q.gender}</b>`;
    if (step === 2) span.innerHTML += ` | Fall: <span style="color:${COLORS[q.case]}">${q.case}</span>`;
    if (step === 3) {
        span.innerHTML += `<br><small>Transl: ${q.translations[selectedLanguage]}</small>`;
        btn.disabled = true;
    }
}

function checkAnswer(qIdx, isCorrect, btn) {
    const choiceContainer = document.getElementById(`choices-${qIdx}`);
    if (choiceContainer.dataset.answered) return;
    choiceContainer.dataset.answered = "true";

    answeredCount++;
    if (isCorrect) score++;

    btn.style.backgroundColor = isCorrect ? COLORS.akkusativ : COLORS.genitiv;
    btn.style.color = "white";

    const feedback = document.getElementById(`feedback-${qIdx}`);
    feedback.innerHTML = `<strong>${isCorrect ? 'Richtig!' : 'Falsch.'}</strong> ${currentQuestions[qIdx].explanation}`;

    if (answeredCount === QUESTIONS_PER_ROUND) {
        document.getElementById("score-display").hidden = false;
        document.getElementById("final-score").innerText = `Ergebnis: ${score} von ${QUESTIONS_PER_ROUND} richtig.`;
    }
}
