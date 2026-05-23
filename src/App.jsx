import { useEffect, useMemo, useState } from 'react';
import { makePool } from './questionBank.js';

const POOL = makePool();

function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeCommand(value = '') {
  return value
    .toLowerCase()
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line
      .replace(/^switch\([^)]*\)#\s*/g, '')
      .replace(/^switch#\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
    .join('\n');
}

function sameSet(a = [], b = []) {
  const aa = [...a].sort((x, y) => x - y);
  const bb = [...b].sort((x, y) => x - y);
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function checkCorrect(question, answer) {
  if (answer === undefined || answer === '') return false;
  if (question.type === 'single') return answer === question.answer;
  if (question.type === 'multi') return sameSet(answer, question.answer);
  if (question.type === 'command') {
    const attempt = normalizeCommand(answer);
    return question.answers.some((accepted) => normalizeCommand(accepted) === attempt);
  }
  if (question.type === 'match') return question.prompts.every((p) => answer?.[p] === question.answerMap[p]);
  return false;
}

function choiceLetter(i) {
  return String.fromCharCode(65 + i);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function App() {
  const [examStarted, setExamStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(50);
  const [minutes, setMinutes] = useState(60);
  const [theme, setTheme] = useState('blue');
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [hints, setHints] = useState({});
  const [reviewFilter, setReviewFilter] = useState('all');

  useEffect(() => {
    if (!examStarted || submitted) return undefined;
    if (remaining <= 0) {
      setSubmitted(true);
      return undefined;
    }
    const timer = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(timer);
  }, [examStarted, submitted, remaining]);

  const current = questions[index];
  const answeredCount = questions.filter((qq) => {
    const a = answers[qq.id];
    if (a === undefined || a === '') return false;
    if (Array.isArray(a)) return a.length > 0;
    if (typeof a === 'object') return Object.keys(a).length > 0;
    return true;
  }).length;

  const score = useMemo(() => {
    const correct = questions.reduce((acc, qq) => acc + (checkCorrect(qq, answers[qq.id]) ? 1 : 0), 0);
    const hintPenalty = Object.keys(hints).length * 0.25;
    const examScore = Math.max(0, correct - hintPenalty);
    return {
      correct,
      hintPenalty,
      examScore,
      percent: questions.length ? Math.round((examScore / questions.length) * 100) : 0,
    };
  }, [questions, answers, hints]);

  function startExam() {
    const selected = shuffleArray(POOL).slice(0, Math.min(Number(count), POOL.length));
    setQuestions(selected);
    setIndex(0);
    setAnswers({});
    setHints({});
    setRemaining(Math.max(1, Number(minutes)) * 60);
    setSubmitted(false);
    setExamStarted(true);
  }

  function resetExam() {
    setExamStarted(false);
    setSubmitted(false);
    setQuestions([]);
    setAnswers({});
    setHints({});
    setIndex(0);
    setRemaining(0);
  }

  function setAnswer(qid, value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function toggleMulti(qid, optionIndex) {
    const previous = answers[qid] || [];
    setAnswer(qid, previous.includes(optionIndex) ? previous.filter((x) => x !== optionIndex) : [...previous, optionIndex]);
  }

  const filteredReview = questions.filter((qq) => {
    const correct = checkCorrect(qq, answers[qq.id]);
    if (reviewFilter === 'correct') return correct;
    if (reviewFilter === 'wrong') return !correct;
    if (reviewFilter === 'command') return qq.type === 'command';
    return true;
  });

  return (
    <div className={`app ${theme}`}>
      <div className="shell">
        <header className="header">
          <div>
            <p className="eyebrow">CCNA Switching</p>
            <h1>STP / Rapid PVST+ Exam Simulator</h1>
            <p className="lead">A focused exam simulator for root election, port roles, STP states, Rapid PVST+, PVST+ per-VLAN logic, PortFast, guard features, IOS commands, topology analysis, and show-output interpretation.</p>
          </div>
          <div className="pool-card">
            <div className="muted">Question pool</div>
            <div className="pool-number">{POOL.length}</div>
            <div className="muted">shuffle-ready</div>
          </div>
        </header>

        {!examStarted && (
          <section className="panel">
            <div className="setup-grid">
              <label>
                <span>Questions to draw</span>
                <select value={count} onChange={(e) => setCount(e.target.value)}>
                  {[20, 30, 50, 75, 100, 125, 150, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label>
                <span>Timer</span>
                <select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
                  {[15, 30, 45, 60, 90, 120, 150].map((n) => <option key={n} value={n}>{n} minutes</option>)}
                </select>
              </label>
              <label>
                <span>Theme</span>
                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="blue">Bluish</option>
                  <option value="red">Reddish</option>
                </select>
              </label>
              <button className="primary" onClick={startExam}>Start simulated exam</button>
            </div>
            <div className="info-grid">
              <div className="info-card"><strong>Exam-like pressure</strong><br />Timer, randomized draw, navigation, unanswered counter, and post-submit review.</div>
              <div className="info-card"><strong>Mixed question types</strong><br />Best answer, multi-select, IOS command input, matching, exhibits, and show-output analysis.</div>
              <div className="info-card"><strong>No lazy STP</strong><br />Tie-breakers, per-VLAN behavior, guard features, and RSTP role/state nuance.</div>
            </div>
          </section>
        )}

        {examStarted && !submitted && current && (
          <main className="exam-grid">
            <section className="panel">
              <div className="top-row">
                <div className="badges">
                  <span className="badge">{current.topic}</span>
                  <span className="badge neutral">{current.type}</span>
                  <span className="badge neutral">{current.difficulty}</span>
                </div>
                <div className="timer">{formatTime(remaining)}</div>
              </div>
              <div className="question-index">Question {index + 1} of {questions.length}</div>
              <h2>{current.stem}</h2>

              {current.exhibit && <pre className="exhibit">{current.exhibit}</pre>}

              <div className="answer-stack">
                {current.type === 'single' && current.choices.map((choice, i) => (
                  <label className={`option ${answers[current.id] === i ? 'selected' : ''}`} key={choice}>
                    <input type="radio" name={`q-${current.id}`} checked={answers[current.id] === i} onChange={() => setAnswer(current.id, i)} />
                    <span><strong>{choiceLetter(i)}.</strong> {choice}</span>
                  </label>
                ))}

                {current.type === 'multi' && current.choices.map((choice, i) => (
                  <label className={`option ${(answers[current.id] || []).includes(i) ? 'selected' : ''}`} key={choice}>
                    <input type="checkbox" checked={(answers[current.id] || []).includes(i)} onChange={() => toggleMulti(current.id, i)} />
                    <span><strong>{choiceLetter(i)}.</strong> {choice}</span>
                  </label>
                ))}

                {current.type === 'command' && (
                  <div>
                    <textarea className="command-box" value={answers[current.id] || ''} onChange={(e) => setAnswer(current.id, e.target.value)} placeholder="Type the IOS command(s). Multiple lines are accepted." />
                    {current.hint && <button className="secondary" type="button" onClick={() => setHints((prev) => ({ ...prev, [current.id]: true }))}>Show hint (-0.25)</button>}
                    {hints[current.id] && <div className="hint">Hint: {current.hint}</div>}
                  </div>
                )}

                {current.type === 'match' && current.prompts.map((prompt) => (
                  <div className="match-row" key={prompt}>
                    <strong>{prompt}</strong>
                    <select value={(answers[current.id] || {})[prompt] || ''} onChange={(e) => setAnswer(current.id, { ...(answers[current.id] || {}), [prompt]: e.target.value })}>
                      <option value="">Choose match...</option>
                      {current.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="nav-row">
                <button className="secondary" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>Previous</button>
                <div>
                  <button className="secondary" onClick={() => setSubmitted(true)}>Submit exam</button>
                  <button className="primary" disabled={index === questions.length - 1} onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}>Next</button>
                </div>
              </div>
            </section>

            <aside className="sidebar">
              <div className="stats">
                <div className="stat"><strong>{answeredCount}</strong><span>answered</span></div>
                <div className="stat"><strong>{questions.length - answeredCount}</strong><span>open</span></div>
              </div>
              <div className="qnav">
                {questions.map((qq, i) => (
                  <button key={qq.id} className={`${i === index ? 'current' : ''} ${answers[qq.id] !== undefined ? 'answered' : ''}`} onClick={() => setIndex(i)}>{i + 1}</button>
                ))}
              </div>
            </aside>
          </main>
        )}

        {examStarted && submitted && (
          <section className="panel">
            <div className="review-head">
              <div>
                <h2>Exam Review</h2>
                <p className="lead">Correct: {score.correct}/{questions.length}. Hint penalty: {score.hintPenalty.toFixed(2)}. Exam score: {score.percent}%.</p>
              </div>
              <div className="review-actions">
                <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
                  <option value="all">All questions</option>
                  <option value="wrong">Wrong only</option>
                  <option value="correct">Correct only</option>
                  <option value="command">Commands only</option>
                </select>
                <button className="primary" onClick={startExam}>Retake shuffled</button>
                <button className="secondary" onClick={resetExam}>Setup</button>
              </div>
            </div>

            <div className="review-list">
              {filteredReview.map((qq, n) => {
                const correct = checkCorrect(qq, answers[qq.id]);
                return (
                  <article className={`review-card ${correct ? 'correct' : 'wrong'}`} key={qq.id}>
                    <p className={correct ? 'correct-line' : 'wrong-line'}><strong>Review #{n + 1}</strong> · {correct ? 'Correct' : 'Wrong'} · {qq.topic}</p>
                    <h3>{qq.stem}</h3>
                    {qq.exhibit && <pre className="exhibit">{qq.exhibit}</pre>}
                    <div>
                      {qq.type === 'single' && <p><strong>Correct answer:</strong> {choiceLetter(qq.answer)}. {qq.choices[qq.answer]}</p>}
                      {qq.type === 'multi' && <p><strong>Correct answers:</strong> {qq.answer.map((a) => `${choiceLetter(a)}. ${qq.choices[a]}`).join(' | ')}</p>}
                      {qq.type === 'command' && <p><strong>Accepted command:</strong><br /><code>{qq.answers[0]}</code></p>}
                      {qq.type === 'match' && <div><strong>Correct matches:</strong>{qq.prompts.map((p) => <div key={p}>• {p} → {qq.answerMap[p]}</div>)}</div>}
                    </div>
                    <p><strong>Why:</strong> {qq.explanation}</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
