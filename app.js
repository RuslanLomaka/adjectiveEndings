"use strict";

const QUESTIONS_PER_ROUND = 10;
const SUPPORTED_LANGS = ["en", "uk", "ro", "ar"];

const GRAMMAR_RULES = {
    akkusativ: `<table>...</table>`, // (Keep your existing tables here)
    dativ: `<table>...</table>`,
    genitiv: `<table>...</table>`
};

let selectedLanguage = "en";
let score = 0;
let answeredCount = 0;
let currentQuestions = [];
const userAnswers = [];

document.addEventListener("DOMContentLoaded", () => {
    initLanguageUI();
    wireModalHandlers();
    loadAndStartQuiz();
    document.getElementById("try-again-button").onclick = () => location.reload();
});

function initLanguageUI() {
    const select = document.getElementById("language-select");
    selectedLanguage = localStorage.getItem("adjQuizLang") || "en";
    select.value = selectedLanguage;
    select.onchange = (e) => {
        selectedLanguage = e.target.value;
        localStorage.setItem("adjQuizLang", selectedLanguage);
    };
}

function loadAndStartQuiz() {
    fetch("data.json")
        .then(r => r.json())
        .then(data => {
            currentQuestions = data.sort(() => 0.5 - Math.random()).slice(0, QUESTIONS_PER_ROUND);
            renderQuestions(currentQuestions);
        });
}

function renderQuestions(questions) {
    const container = document.getElementById("questions-container");
    container.innerHTML = questions.map((q, idx) => `
        <div class="question-container" id="qc-${idx}">
            <div class="q-header">Frage ID: ${q.id}</div>
            <div class="question-text">${q.question}</div>
            <div class="choices" data-qidx="${idx}">
                ${q.answers.map(a => `<button class="choice-btn" data-correct="${a.correct}">${a.text}</button>`).join("")}
            </div>
            <div class="hint-section">
                <button class="hint-btn" data-idx="${idx}">Hinweis</button>
                <span id="hint-text-${idx}" class="hint-text"></span>
            </div>
            <div class="feedback" id="feedback-${idx}"></div>
        </div>
    `).join("");

    container.onclick = (e) => {
        if (e.target.classList.contains("choice-btn")) handleSelection(e.target);
        if (e.target.classList.contains("hint-btn")) handleHint(e.target);
        if (e.target.classList.contains("case-link")) openGrammarModal(e.target.dataset.fall);
    };
}

function handleSelection(btn) {
    const parent = btn.closest(".choices");
    if (parent.dataset.answered) return;
    
    parent.dataset.answered = "true";
    const qIdx = parent.dataset.qidx;
    const isCorrect = btn.dataset.correct === "true";
    const q = currentQuestions[qIdx];

    answeredCount++;
    if (isCorrect) score++;

    btn.classList.add(isCorrect ? "correct-selection" : "incorrect-selection");
    
    // Reveal info immediately on answer
    const feedback = document.getElementById(`feedback-${qIdx}`);
    feedback.innerHTML = `<span class="${isCorrect ? 'correct' : 'incorrect'}">
        ${isCorrect ? 'Richtig!' : 'Falsch.'} ${q.explanation}
    </span>`;

    if (answeredCount === currentQuestions.length) revealFinalScore();
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
        span.innerHTML += `<br><small>Übersetzung: ${trans}</small>`;
        btn.disabled = true;
    }
}

function revealFinalScore() {
    document.getElementById("score-display").hidden = false;
    document.getElementById("final-score").textContent = `Du hast ${score} von ${QUESTIONS_PER_ROUND} richtig beantwortet.`;
}

// ... wireModalHandlers and openGrammarModal remain same as previous working version ...
