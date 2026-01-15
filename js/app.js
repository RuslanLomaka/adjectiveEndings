'use strict';

const container = document.getElementById('questions-container');
const shuffleButton = document.getElementById('shuffle-button');

let QUESTIONS = []; // loaded from JSON

shuffleButton.addEventListener('click', () => {
  // Same behavior: reorder question blocks visually
  const nodes = Array.from(container.children);
  fisherYatesShuffle(nodes);
  container.innerHTML = '';
  nodes.forEach(n => container.appendChild(n));
});

init();

async function init() {
  try {
    const res = await fetch('data/questions.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load questions.json (${res.status})`);
    const data = await res.json();

    QUESTIONS = Array.isArray(data.questions) ? data.questions : [];
    renderAllQuestions(QUESTIONS);
  } catch (err) {
    container.innerHTML = `
      <div class="question-container">
        <p><strong>Error:</strong> ${escapeHtml(String(err.message || err))}</p>
        <p>Check file paths: <code>data/questions.json</code></p>
      </div>
    `;
  }
}

function renderAllQuestions(questions) {
  container.innerHTML = '';
  questions.forEach(q => container.appendChild(renderQuestion(q)));
}

function renderQuestion(q) {
  // Defensive defaults
  const qid = q.id || cryptoRandomId();
  const prompt = q.prompt || '(missing prompt)';
  const base = q.base ? ` <span style="opacity:.7">(${escapeHtml(q.base)})</span>` : '';

  const wrapper = document.createElement('div');
  wrapper.className = 'question-container';
  wrapper.dataset.qid = qid;

  const p = document.createElement('p');
  p.innerHTML = `<strong>${escapeHtml(prompt)}</strong>${base}`;
  wrapper.appendChild(p);

  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'choices';

  const feedback = document.createElement('div');
  feedback.className = 'feedback';
  feedback.id = `feedback-${qid}`;

  const answerKey = q.answer;

  (q.choices || []).forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.type = 'button';
    btn.textContent = choice.text ?? '(missing)';
    btn.addEventListener('click', () => {
      const isCorrect = (choice.key === answerKey);
      showFeedback(feedback, isCorrect, choice.text, choice.explain);
    });
    choicesDiv.appendChild(btn);
  });

  wrapper.appendChild(choicesDiv);
  wrapper.appendChild(feedback);

  return wrapper;
}

function showFeedback(feedbackEl, isCorrect, selectedText, explanation) {
  if (isCorrect) {
    feedbackEl.innerHTML =
      `<span class="correct">Correct! 🎉</span> The correct form is: <strong>${escapeHtml(String(selectedText))}</strong>.<br>` +
      `${escapeHtml(String(explanation || ''))}`;
  } else {
    feedbackEl.innerHTML =
      `<span class="incorrect">Incorrect. 😢</span><br>` +
      `${escapeHtml(String(explanation || 'Think case + gender + article.'))}`;
  }
}

/** Unbiased shuffle for dev correctness */
function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cryptoRandomId() {
  // fallback id if someone forgets to set q.id
  return 'q_' + Math.random().toString(16).slice(2);
}
