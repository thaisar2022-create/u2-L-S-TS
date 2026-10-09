/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PageTab,
  LearnTab,
  PracticeMode,
  WordItem,
  SentenceItem,
} from './types';
import {
  words,
  sentences,
  unit2GrammarPatterns,
  schoolPhonetics,
  qaLessons,
  rearrangeLessons,
  quizQuestions,
  blanks,
  fillVocabulary,
} from './data/unit2Data';

export default function App() {
  // Navigation & Tabs
  const [page, setPage] = useState<PageTab>('home');
  const [learnTab, setLearnTab] = useState<LearnTab>('Words');

  // Indices
  const [learnIndex, setLearnIndex] = useState<number>(0);
  const [qaIndex, setQaIndex] = useState<number>(0);
  const [flashIndex, setFlashIndex] = useState<number>(0);
  const [flashBack, setFlashBack] = useState<boolean>(false);

  // Practice state
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('quiz');
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [quizResponses, setQuizResponses] = useState<
    { index: number; choice: number; correct: boolean }[]
  >([]);
  const [quizScore, setQuizScore] = useState<number>(0);

  // Listen & Fill state
  const [blankIndex, setBlankIndex] = useState<number>(0);
  const [fillChoice, setFillChoice] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState<boolean>(false);

  // Rearrange state
  const [reorderIndex, setReorderIndex] = useState<number>(0);
  const [reorderPicked, setReorderPicked] = useState<number[]>([]);
  const [reorderChecked, setReorderChecked] = useState<boolean>(false);

  // Settings & Audio
  const [speed, setSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('thaiSpeed');
    return saved ? parseFloat(saved) : 0.85;
  });
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Recording
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [audioURLs, setAudioURLs] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Progress tracking
  const [doneList, setDoneList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('thaiDoneUnit2V4');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Calculate total activities count for progress
  const totalActivities = useMemo(() => {
    return (
      words.length +
      sentences.length +
      qaLessons.length +
      rearrangeLessons.length +
      quizQuestions.length +
      blanks.length
    );
  }, []);

  const progressPct = useMemo(() => {
    if (totalActivities === 0) return 0;
    return Math.min(100, Math.round((doneList.length / totalActivities) * 100));
  }, [doneList.length, totalActivities]);

  const markDone = (key: string) => {
    setDoneList((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      localStorage.setItem('thaiDoneUnit2V4', JSON.stringify(next));
      return next;
    });
  };

  // Service worker registration & voice detection
  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const loadVoices = () => {
      if ('speechSynthesis' in window) {
        const v = window.speechSynthesis.getVoices();
        setAvailableVoices(v);
      }
    };

    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Text-To-Speech
  const speak = (text: string, customSpeed?: number) => {
    if (!('speechSynthesis' in window)) {
      alert('ဤဖုန်းတွင် စာသားမှ အသံဖတ်သည့်စနစ် မရရှိပါ။');
      return;
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = customSpeed ?? speed;

    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const thaiVoice =
      voices.find((v) => v.lang.toLowerCase() === 'th-th') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('th'));

    if (thaiVoice) {
      u.voice = thaiVoice;
    } else {
      setStatusMessage(
        'Thai voice not found. Your phone may use a fallback voice. For accurate Thai tones, use recorded audio in the production app.'
      );
    }

    window.speechSynthesis.speak(u);
  };

  // Audio Recording
  const toggleRecord = async (id: string) => {
    if (recordingId === id && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingId(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Recording requires HTTPS (or localhost) and a compatible browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioURLs((prev) => {
          if (prev[id]) URL.revokeObjectURL(prev[id]);
          return { ...prev, [id]: url };
        });
      };

      recorder.start();
      setRecordingId(id);
    } catch (e: any) {
      alert('Microphone permission unavailable: ' + (e?.message || e));
    }
  };

  const handleNavigate = (tab: PageTab) => {
    setPage(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Learn tab handlers
  const stepLearn = (delta: number) => {
    const list = learnTab === 'Words' ? words : sentences;
    markDone(`learn-${learnTab}-${learnIndex}`);
    setLearnIndex((prev) => (prev + delta + list.length) % list.length);
  };

  const stepQA = (delta: number) => {
    markDone(`learn-qa-${qaIndex}`);
    setQaIndex((prev) => (prev + delta + qaLessons.length) % qaLessons.length);
  };

  // Flashcards handlers
  const nextFlash = (delta: number) => {
    setFlashIndex((prev) => (prev + delta + words.length) % words.length);
    setFlashBack(false);
  };

  const flipFlash = () => {
    setFlashBack((prev) => !prev);
    markDone(`card-${flashIndex}`);
  };

  // Practice Mode: Rearrange helper
  const currentRearrange = rearrangeLessons[reorderIndex];
  const rearrangeBankOrder = useMemo(() => {
    const n = currentRearrange.parts.length;
    return Array.from({ length: n }, (_, i) => n - 1 - i);
  }, [currentRearrange]);

  const availableRearrange = useMemo(() => {
    return rearrangeBankOrder.filter((id) => !reorderPicked.includes(id));
  }, [rearrangeBankOrder, reorderPicked]);

  const rearrangeComplete = reorderPicked.length === currentRearrange.parts.length;
  const rearrangeCorrect =
    reorderChecked &&
    rearrangeComplete &&
    reorderPicked.every((id, j) => id === j);

  const pickRearranged = (id: number) => {
    if (reorderPicked.includes(id) || reorderPicked.length >= currentRearrange.parts.length) return;
    setReorderPicked((prev) => [...prev, id]);
    setReorderChecked(false);
  };

  const removeRearranged = (id: number) => {
    setReorderPicked((prev) => prev.filter((item) => item !== id));
    setReorderChecked(false);
  };

  const checkRearranged = () => {
    if (!rearrangeComplete) return;
    setReorderChecked(true);
    if (reorderPicked.every((id, j) => id === j)) {
      markDone(`rearrange-${reorderIndex}`);
    }
  };

  const resetRearranged = () => {
    setReorderPicked([]);
    setReorderChecked(false);
  };

  const nextRearranged = () => {
    setReorderIndex((prev) => (prev + 1) % rearrangeLessons.length);
    resetRearranged();
  };

  // Listen & Fill handlers
  const currentBlank = blanks[blankIndex % blanks.length];
  const correctBlankChoice = currentBlank.choices.indexOf(currentBlank.answer);

  const chooseFill = (idx: number) => {
    if (fillChecked) return;
    setFillChoice(idx);
  };

  const checkBlank = () => {
    if (fillChecked || fillChoice === null) return;
    setFillChecked(true);
    if (currentBlank.choices[fillChoice] === currentBlank.answer) {
      markDone(`blank-${blankIndex}`);
    }
  };

  const retryFill = () => {
    setFillChoice(null);
    setFillChecked(false);
  };

  const completeFillExercise = () => {
    if (fillChecked && fillChoice !== null && currentBlank.choices[fillChoice] === currentBlank.answer) {
      markDone(`blank-${blankIndex}`);
    }
    setBlankIndex((prev) => (prev + 1) % blanks.length);
    setFillChoice(null);
    setFillChecked(false);
  };

  // Quiz handlers
  const currentQuiz = quizQuestions[quizIndex];
  const pickedQuiz = quizResponses.find((r) => r.index === quizIndex);

  const chooseQuiz = (choiceIdx: number) => {
    if (pickedQuiz) return;
    const isCorrect = choiceIdx === currentQuiz.correct;
    setQuizResponses((prev) => [...prev, { index: quizIndex, choice: choiceIdx, correct: isCorrect }]);
    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
    }
  };

  const nextQuiz = () => {
    const nextIdx = quizIndex + 1;
    setQuizIndex(nextIdx);
    if (nextIdx >= quizQuestions.length) {
      markDone('unit2-quiz-completed');
    }
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setQuizResponses([]);
    setQuizScore(0);
  };

  return (
    <div className="app">
      {/* Top Hero Banner */}
      <header className="hero">
        <div className="top">
          <div className="brandwrap">
            <img
              className="school-logo"
              src="/school-logo.png"
              alt="ThaiSar school logo"
              onError={(e) => {
                // Fallback to SVG or circular badge
                e.currentTarget.src = '/school-logo.svg';
              }}
            />
            <div>
              <div className="brand-title">THAISAR</div>
              <div className="logo-label">Thai · Myanmar Speaking School</div>
            </div>
          </div>
          <div className="pill">🇹🇭 + 🇲🇲</div>
        </div>
        <h1>အခန်း (၂) · နှုတ်ဆက်ခြင်း</h1>
        <p>Unit 2 · Listening & Speaking · Beginner</p>
        <div className="progress">
          <span style={{ width: `${progressPct}%` }}></span>
        </div>
        <div className="small" style={{ marginTop: '7px', color: '#e2f9f0' }}>
          သင်ယူမှု တိုးတက်မှု · {progressPct}% ({doneList.length} activities)
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content">
        {/* ======================= HOME PAGE ======================= */}
        {page === 'home' && (
          <div>
            <div className="section-head">
              <h2>စတင်လေ့လာပါ 🌼</h2>
              <span className="muted">အခန်း ၂</span>
            </div>
            <div className="notice">
              အသံကို နားထောင်ပါ → လိုက်ပြောပါ → စာကြောင်းကို လေ့ကျင့်ပါ။ ထိုင်းအက္ခရာ အရင်ကျက်ရန် မလိုပါ။
            </div>
            <div className="rows" style={{ marginTop: '14px' }}>
              <button
                className="tile"
                onClick={() => {
                  setLearnTab('Words');
                  setLearnIndex(0);
                  handleNavigate('learn');
                }}
              >
                <span className="emoji">📖</span>
                <strong>စကားလုံးများ</strong>
                <small>Vocabulary · {words.length} items</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  setLearnTab('Sentences');
                  setLearnIndex(0);
                  handleNavigate('learn');
                }}
              >
                <span className="emoji">🎧</span>
                <strong>ဝါကျများ</strong>
                <small>Listen & repeat · {sentences.length}</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  setLearnTab('Grammar');
                  handleNavigate('learn');
                }}
              >
                <span className="emoji">🧩</span>
                <strong>သဒ္ဒါ</strong>
                <small>Tap to see examples</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  setLearnTab('Q & A');
                  setQaIndex(0);
                  handleNavigate('learn');
                }}
              >
                <span className="emoji">💬</span>
                <strong>အမေး / အဖြေ</strong>
                <small>10 listen & repeat pairs</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  setPracticeMode('quiz');
                  resetQuiz();
                  handleNavigate('practice');
                }}
              >
                <span className="emoji">📝</span>
                <strong>Unit 2 Quiz</strong>
                <small>12 comprehension questions</small>
              </button>
            </div>

            <h3 style={{ marginTop: '24px' }}>ဒီနေ့ လေ့လာမယ့် ဝါကျ</h3>
            <div className="card">
              <span className="tag">Listen & repeat</span>
              <div className="thai" lang="th">
                {sentences[0][0]}
              </div>
              <div className="phonetic">{sentences[0][1]}</div>
              <div className="mm" lang="my">
                {sentences[0][2]}
              </div>
              <div className="controls">
                <button className="btn" onClick={() => speak(sentences[0][0])}>
                  🔊 နားထောင်ပါ
                </button>
                <button className="btn secondary" onClick={() => speak(sentences[0][0], 0.7)}>
                  🐢 Slow
                </button>
              </div>
            </div>

            <button
              className="btn wide"
              onClick={() => {
                setLearnTab('Words');
                handleNavigate('learn');
              }}
            >
              သင်ခန်းစာ စတင်ရန် →
            </button>
          </div>
        )}

        {/* ======================= LEARN PAGE ======================= */}
        {page === 'learn' && (
          <div>
            {learnTab === 'Q & A' && (
              <div>
                <div className="section-head">
                  <h2>မေးခွန်းနှင့် အဖြေ · Q & A</h2>
                  <span className="counter">
                    {qaIndex + 1} / {qaLessons.length}
                  </span>
                </div>
                <div className="controls">
                  {(['Words', 'Sentences', 'Q & A', 'Grammar'] as LearnTab[]).map((tab) => (
                    <button
                      key={tab}
                      className={`btn ${learnTab === tab ? '' : 'secondary'}`}
                      onClick={() => {
                        setLearnTab(tab);
                        setLearnIndex(0);
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <p className="section-intro">
                  မေးခွန်းနှင့် အဖြေကို တစ်ကြောင်းချင်း နားထောင်၍ လိုက်ပြောပါ။ ဖြေရန် မလိုပါ။
                </p>

                <div className="card">
                  {/* Question */}
                  <div className="qa-item">
                    <span className="tag">Q · မေးခွန်း</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][0]}
                    </div>
                    <div className="phonetic">
                      {schoolPhonetics[qaLessons[qaIndex][0]] || ''}
                    </div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][2]}
                    </div>
                    <div className="controls">
                      <button className="btn" onClick={() => speak(qaLessons[qaIndex][0])}>
                        🔊 နားထောင်ပါ
                      </button>
                      <button className="btn secondary" onClick={() => speak(qaLessons[qaIndex][0], 0.7)}>
                        🐢 Slow
                      </button>
                      <button
                        className={`btn ghost ${recordingId === 'qaQ' ? 'recording' : ''}`}
                        onClick={() => toggleRecord('qaQ')}
                      >
                        {recordingId === 'qaQ' ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
                      </button>
                    </div>
                    {audioURLs['qaQ'] && (
                      <div style={{ marginTop: '10px' }}>
                        <p className="muted">သင့်အသံကို ပြန်နားထောင်ပါ</p>
                        <audio controls src={audioURLs['qaQ']} />
                      </div>
                    )}
                  </div>

                  <div className="qa-divider">↓ Answer · အဖြေ</div>

                  {/* Answer */}
                  <div className="qa-item">
                    <span className="tag">A · အဖြေ</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][1]}
                    </div>
                    <div className="phonetic">
                      {schoolPhonetics[qaLessons[qaIndex][1]] || ''}
                    </div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][3]}
                    </div>
                    <div className="controls">
                      <button className="btn" onClick={() => speak(qaLessons[qaIndex][1])}>
                        🔊 နားထောင်ပါ
                      </button>
                      <button className="btn secondary" onClick={() => speak(qaLessons[qaIndex][1], 0.7)}>
                        🐢 Slow
                      </button>
                      <button
                        className={`btn ghost ${recordingId === 'qaA' ? 'recording' : ''}`}
                        onClick={() => toggleRecord('qaA')}
                      >
                        {recordingId === 'qaA' ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
                      </button>
                    </div>
                    {audioURLs['qaA'] && (
                      <div style={{ marginTop: '10px' }}>
                        <p className="muted">သင့်အသံကို ပြန်နားထောင်ပါ</p>
                        <audio controls src={audioURLs['qaA']} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="controls">
                  <button className="btn secondary" onClick={() => stepQA(-1)}>
                    ← အရင်တစ်ခု
                  </button>
                  <button className="btn" onClick={() => stepQA(1)}>
                    နောက်တစ်ခု →
                  </button>
                </div>
                {statusMessage && <p className="footnote">{statusMessage}</p>}
              </div>
            )}

            {learnTab === 'Grammar' && (
              <div>
                <div className="section-head">
                  <h2>သဒ္ဒါ · Grammar</h2>
                  <span className="counter">{unit2GrammarPatterns.length} patterns</span>
                </div>
                <div className="controls">
                  {(['Words', 'Sentences', 'Q & A', 'Grammar'] as LearnTab[]).map((tab) => (
                    <button
                      key={tab}
                      className={`btn ${learnTab === tab ? '' : 'secondary'}`}
                      onClick={() => {
                        setLearnTab(tab);
                        setLearnIndex(0);
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <p className="section-intro">
                  အခန်း (၂) စာအုပ်မှ ဝါကျများတွင် ပါဝင်သော သဒ္ဒါပုံစံများကို စုစည်းထားပါသည်။ ခေါင်းစဉ်ကို နှိပ်ပြီး ထိုင်းစာ၊ အသံထွက်နှင့် မြန်မာအဓိပ္ပာယ်ကို လေ့လာပါ။
                </p>

                {unit2GrammarPatterns.map((g, j) => {
                  const patternExamples = g.examples
                    .map((t) => sentences.find((s) => s[0] === t))
                    .filter(Boolean) as SentenceItem[];

                  return (
                    <details className="grammar-accordion" key={j} open={j === 0}>
                      <summary>
                        {j + 1}. {g.title}
                      </summary>
                      <div className="grammar-body">
                        <h3 style={{ marginTop: '15px' }}>{g.formula}</h3>
                        <p className="muted">{g.explain}</p>
                        {patternExamples.map((x, exIdx) => (
                          <div
                            key={exIdx}
                            style={{
                              padding: '15px 0',
                              borderTop: '1px solid #efe7f1',
                            }}
                          >
                            <div className="thai" style={{ fontSize: '23px' }} lang="th">
                              {x[0]}
                            </div>
                            <div className="phonetic">{x[1]}</div>
                            <div className="mm" lang="my">
                              {x[2]}
                            </div>
                            <div className="controls">
                              <button className="btn" onClick={() => speak(x[0])}>
                                🔊 နားထောင်ပါ
                              </button>
                              <button className="btn secondary" onClick={() => speak(x[0], 0.7)}>
                                🐢 Slow
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {(learnTab === 'Words' || learnTab === 'Sentences') && (
              <div>
                {(() => {
                  const arr = learnTab === 'Words' ? words : sentences;
                  const safeIdx = Math.min(learnIndex, arr.length - 1);
                  const item = arr[safeIdx];
                  const recKey = `learn-${learnTab}-${safeIdx}`;

                  return (
                    <div>
                      <div className="section-head">
                        <h2>နားထောင်ပြီး လိုက်ပြောပါ</h2>
                        <span className="counter">
                          {safeIdx + 1} / {arr.length}
                        </span>
                      </div>
                      <div className="controls">
                        {(['Words', 'Sentences', 'Q & A', 'Grammar'] as LearnTab[]).map((tab) => (
                          <button
                            key={tab}
                            className={`btn ${learnTab === tab ? '' : 'secondary'}`}
                            onClick={() => {
                              setLearnTab(tab);
                              setLearnIndex(0);
                            }}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div className="card">
                        <span className="tag">{item[3]}</span>
                        <div className="thai" lang="th">
                          {item[0]}
                        </div>
                        <div className="phonetic">{item[1]}</div>
                        <div className="mm" lang="my">
                          {item[2]}
                        </div>
                        <div className="controls">
                          <button className="btn" onClick={() => speak(item[0])}>
                            🔊 နားထောင်ပါ
                          </button>
                          <button className="btn secondary" onClick={() => speak(item[0], 0.7)}>
                            🐢 Slow
                          </button>
                          <button
                            className={`btn ghost ${recordingId === recKey ? 'recording' : ''}`}
                            onClick={() => toggleRecord(recKey)}
                          >
                            {recordingId === recKey ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
                          </button>
                        </div>
                        {audioURLs[recKey] && (
                          <div style={{ marginTop: '10px' }}>
                            <p className="muted">သင့်အသံကို ပြန်နားထောင်ပါ</p>
                            <audio controls src={audioURLs[recKey]} />
                          </div>
                        )}
                      </div>

                      <div className="controls">
                        <button className="btn secondary" onClick={() => stepLearn(-1)}>
                          ← ရှေ့သို့
                        </button>
                        <button className="btn" onClick={() => stepLearn(1)}>
                          သိပြီ · Next →
                        </button>
                      </div>
                      {statusMessage && <p className="footnote">{statusMessage}</p>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ======================= FLASHCARDS PAGE ======================= */}
        {page === 'flash' && (
          <div>
            {(() => {
              const safeFlashIdx = flashIndex % words.length;
              const w = words[safeFlashIdx];
              return (
                <div>
                  <div className="section-head">
                    <h2>Flashcards · မှတ်ဉာဏ်လေ့ကျင့်</h2>
                    <span className="counter">
                      {safeFlashIdx + 1} / {words.length}
                    </span>
                  </div>
                  <div
                    className="card"
                    style={{
                      textAlign: 'center',
                      minHeight: '310px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={flipFlash}
                  >
                    <span className="tag">{flashBack ? 'Meaning' : 'Thai word'}</span>
                    {flashBack ? (
                      <div className="mm" style={{ fontSize: '26px' }} lang="my">
                        {w[2]}
                      </div>
                    ) : (
                      <>
                        <div className="thai" lang="th">
                          {w[0]}
                        </div>
                        <div className="phonetic">{w[1]}</div>
                      </>
                    )}
                    <p className="muted" style={{ marginTop: '16px' }}>
                      ကတ်ကိုနှိပ်ပြီး လှန်ကြည့်ပါ
                    </p>
                  </div>
                  <div className="controls">
                    <button className="btn secondary" onClick={() => speak(w[0])}>
                      🔊 နားထောင်ပါ
                    </button>
                    <button className="btn ghost" onClick={() => nextFlash(-1)}>
                      ← ရှေ့သို့
                    </button>
                    <button className="btn" onClick={() => nextFlash(1)}>
                      နောက်တစ်ခု →
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ======================= PRACTICE PAGE ======================= */}
        {page === 'practice' && (
          <div>
            <div className="section-head">
              <h2>Practice · လေ့ကျင့်ခန်း</h2>
            </div>
            <div className="rows practice-tiles">
              <button
                className={`tile ${practiceMode === 'quiz' ? 'active-practice' : ''}`}
                onClick={() => setPracticeMode('quiz')}
              >
                <span>📝</span>
                <strong>Unit 2 Quiz</strong>
                <small>သင်ယူထားသည်ကို စမ်းစစ်ပါ</small>
              </button>
              <button
                className={`tile ${practiceMode === 'blank' ? 'active-practice' : ''}`}
                onClick={() => setPracticeMode('blank')}
              >
                <span>🎧</span>
                <strong>Listen & Fill</strong>
                <small>နားထောင်ပြီး ဖြည့်ပါ</small>
              </button>
              <button
                className={`tile ${practiceMode === 'rearrange' ? 'active-practice' : ''}`}
                onClick={() => setPracticeMode('rearrange')}
              >
                <span>🧩</span>
                <strong>Rearrange Sentence</strong>
                <small>စကားလုံးများကို အစီအစဉ်မှန် စီပါ</small>
              </button>
            </div>

            {/* Practice Exercise: Unit 2 Quiz */}
            {practiceMode === 'quiz' && (
              <div>
                {quizIndex >= quizQuestions.length ? (
                  <div className="card quiz-finish">
                    <div className="bigscore">
                      {Math.round((quizScore / quizQuestions.length) * 100)}%
                    </div>
                    <h2>Unit 2 Quiz ပြီးပါပြီ!</h2>
                    <p className="mm" lang="my">
                      {quizScore} / {quizQuestions.length} မှန်ပါတယ်။
                    </p>
                    <p className="muted">
                      မှားခဲ့သော မေးခွန်းများကို ပြန်ကြည့်ပြီး နောက်တစ်ကြိမ် စမ်းကြည့်နိုင်ပါတယ်။
                    </p>
                    {quizResponses
                      .filter((x) => !x.correct)
                      .map((x) => (
                        <div className="quiz-review" key={x.index}>
                          <strong>{quizQuestions[x.index].q}</strong>
                          <p className="muted">{quizQuestions[x.index].why}</p>
                        </div>
                      ))}
                    <button className="btn wide" onClick={resetQuiz} style={{ marginTop: '16px' }}>
                      🔄 Quiz ပြန်ဖြေရန်
                    </button>
                  </div>
                ) : (
                  <div className="card">
                    <span className="tag">
                      Unit 2 Quiz · {quizIndex + 1} / {quizQuestions.length}
                    </span>
                    <div className="quiz-progress">
                      <span
                        style={{
                          width: `${(100 * quizIndex) / quizQuestions.length}%`,
                        }}
                      ></span>
                    </div>
                    <h3 className="quiz-question">{currentQuiz.q}</h3>
                    {currentQuiz.audio && (
                      <div className="controls" style={{ marginBottom: '14px' }}>
                        <button className="btn" onClick={() => speak(currentQuiz.audio!)}>
                          🔊 အသံနားထောင်ပါ
                        </button>
                        <button
                          className="btn secondary"
                          onClick={() => speak(currentQuiz.audio!, 0.7)}
                        >
                          🐢 Slow
                        </button>
                      </div>
                    )}
                    <div className="stack" style={{ marginTop: '17px' }}>
                      {currentQuiz.choices.map((opt, j) => {
                        let stateClass = '';
                        if (pickedQuiz) {
                          if (j === currentQuiz.correct) stateClass = 'correct';
                          else if (j === pickedQuiz.choice) stateClass = 'incorrect';
                        }
                        return (
                          <button
                            key={j}
                            className={`quiz-option ${stateClass}`}
                            disabled={!!pickedQuiz}
                            onClick={() => chooseQuiz(j)}
                          >
                            {String.fromCharCode(65 + j)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                    {pickedQuiz ? (
                      <div>
                        <div className="quiz-feedback">
                          {pickedQuiz.correct ? '✅ မှန်ပါတယ်!' : '❌ လေ့လာပြီး ထပ်စမ်းကြည့်ပါ။'}
                          <p>{currentQuiz.why}</p>
                        </div>
                        <button className="btn wide" onClick={nextQuiz}>
                          {quizIndex === quizQuestions.length - 1
                            ? 'ရလဒ် ကြည့်ရန် →'
                            : 'နောက်မေးခွန်း →'}
                        </button>
                      </div>
                    ) : (
                      <p className="muted" style={{ marginTop: '12px' }}>
                        အဖြေတစ်ခုကို ရွေးပါ။
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Practice Exercise: Listen & Fill */}
            {practiceMode === 'blank' && (
              <div className="card fill-card">
                <span className="tag">
                  🎧 Listen & Fill · {(blankIndex % blanks.length) + 1} / {blanks.length}
                </span>
                <p className="section-intro">
                  အသံကို နားထောင်ပြီး အဖြေမှန်ကို ရွေးပါ။ <strong>ထိုင်းစာဖတ်တတ်ရန် မလိုပါ။</strong>{' '}
                  ကတ်တစ်ခုစီတွင် ထိုင်းစာ၊ စာအုပ်သုံး phonetic၊ မြန်မာအသံထွက်နှင့် မြန်မာအဓိပ္ပာယ် ပါရှိသည်။
                </p>

                <div className="fill-prompt">
                  <span className="fill-prompt-label">မြန်မာအဓိပ္ပာယ်</span>
                  <div className="mm" lang="my">
                    {currentBlank.meaning}
                  </div>
                  <div className="fill-blank-line" lang="th">
                    {currentBlank.blank}
                  </div>
                </div>

                <div className="controls">
                  <button className="btn" onClick={() => speak(currentBlank.full)}>
                    🔊 နားထောင်ပါ
                  </button>
                  <button className="btn secondary" onClick={() => speak(currentBlank.full, 0.7)}>
                    🐢 ဖြည်းဖြည်း
                  </button>
                </div>

                <h3 className="fill-heading">အဖြေတစ်ခုကို ရွေးပါ။</h3>
                <div className="fill-options" role="group" aria-label="Listen and Fill multiple choices">
                  {currentBlank.choices.map((word, j) => {
                    const entry = fillVocabulary[word] || ['', '', ''];
                    let stateClass = '';
                    if (fillChecked) {
                      if (j === correctBlankChoice) stateClass = ' is-correct';
                      else if (j === fillChoice) stateClass = ' is-wrong';
                    } else if (fillChoice === j) {
                      stateClass = ' is-selected';
                    }

                    return (
                      <button
                        type="button"
                        key={j}
                        className={`fill-choice${stateClass}`}
                        onClick={() => chooseFill(j)}
                        disabled={fillChecked}
                        aria-pressed={fillChoice === j}
                        aria-label={`${word} · ${entry[2]}`}
                      >
                        <span className="fill-number">{String.fromCharCode(65 + j)}</span>
                        <span className="fill-lines">
                          <span className="fill-thai" lang="th">
                            {word}
                          </span>
                          <span className="fill-phonetic">{entry[0]}</span>
                          <span className="fill-pronunciation" lang="my">
                            {entry[1]}
                          </span>
                          <span className="fill-meaning" lang="my">
                            {entry[2]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {!fillChecked ? (
                  <button
                    className="btn wide"
                    onClick={checkBlank}
                    disabled={fillChoice === null}
                  >
                    အဖြေစစ်ဆေးပါ
                  </button>
                ) : (
                  <div>
                    <div
                      className={`fill-feedback ${
                        fillChoice === correctBlankChoice ? 'good' : 'retry'
                      }`}
                      role="status"
                    >
                      <strong>
                        {fillChoice === correctBlankChoice
                          ? '✅ မှန်ပါတယ်!'
                          : '📖 အဖြေမှန်ကို လေ့လာပါ။'}
                      </strong>
                      <p>
                        {fillChoice === correctBlankChoice
                          ? 'အသံကို မှန်ကန်စွာ ရွေးချယ်နိုင်ပါတယ်။'
                          : 'မှားသောအဖြေကို ပြထားပြီး အဖြေမှန်ကို အစိမ်းရောင်ဖြင့် ပြထားပါတယ်။'}
                      </p>
                      <div className="fill-fully">
                        <div className="thai" lang="th">
                          {currentBlank.full}
                        </div>
                        <div className="phonetic">
                          {schoolPhonetics[currentBlank.full] || ''}
                        </div>
                        <div className="mm" lang="my">
                          {currentBlank.meaning}
                        </div>
                      </div>
                    </div>

                    <div className="controls">
                      <button className="btn secondary" onClick={retryFill}>
                        ↺ ပြန်လေ့ကျင့်ရန်
                      </button>
                      <button className="btn" onClick={completeFillExercise}>
                        {blankIndex === blanks.length - 1 ? 'အစက ပြန်လေ့ကျင့်ရန်' : 'နောက်မေးခွန်း →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Practice Exercise: Rearrange Sentence */}
            {practiceMode === 'rearrange' && (
              <div className="card">
                <span className="tag">
                  Rearrange Sentence · {reorderIndex + 1} / {rearrangeLessons.length}
                </span>
                <p className="section-intro">
                  မြန်မာအဓိပ္ပာယ်ကို ဖတ်ပြီး ထိုင်းစကားလုံးများကို အစီအစဉ်မှန် စီပါ။ ကတ်တစ်ခုစီတွင် ထိုင်းစာ၊ စာအုပ်သုံး phonetic နှင့် မြန်မာအသံထွက် ပါရှိသည်။
                </p>

                <div className="reorder-prompt">
                  <strong>မြန်မာအဓိပ္ပာယ်</strong>
                  <div className="mm" lang="my">
                    {currentRearrange.meaning}
                  </div>
                </div>

                <div className="controls">
                  <button
                    className="btn secondary"
                    onClick={() => speak(currentRearrange.parts.map((p) => p[0]).join(''))}
                  >
                    🔊 နားထောင်ပါ
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => speak(currentRearrange.parts.map((p) => p[0]).join(''), 0.7)}
                  >
                    🐢 အနှေးအသံ
                  </button>
                </div>

                {/* Section 1: Chosen sequence */}
                <div className="reorder-area">
                  <h4>၁။ စီထားသော စကားလုံးများ (နှိပ်၍ ပြန်ဖြုတ်နိုင်ပါသည်)</h4>
                  <div className="reorder-tiles">
                    {reorderPicked.length > 0 ? (
                      reorderPicked.map((id) => {
                        const part = currentRearrange.parts[id];
                        return (
                          <button
                            key={id}
                            type="button"
                            className="reorder-token selected"
                            onClick={() => removeRearranged(id)}
                            aria-label={`Remove ${part[0]}`}
                          >
                            <span className="reorder-thai" lang="th">
                              {part[0]}
                            </span>
                            <span className="reorder-phon">{part[1]}</span>
                            <span className="reorder-my" lang="my">
                              {part[2]}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="reorder-empty">အောက်က ကတ်များကို အစဉ်လိုက် နှိပ်ပါ။</div>
                    )}
                  </div>
                </div>

                {/* Section 2: Word bank */}
                <div className="reorder-bank">
                  <h4>၂။ စကားလုံးကတ်များ</h4>
                  <div className="reorder-tiles">
                    {availableRearrange.length > 0 ? (
                      availableRearrange.map((id) => {
                        const part = currentRearrange.parts[id];
                        return (
                          <button
                            key={id}
                            type="button"
                            className="reorder-token"
                            onClick={() => pickRearranged(id)}
                            aria-label={`Choose ${part[0]}`}
                          >
                            <span className="reorder-thai" lang="th">
                              {part[0]}
                            </span>
                            <span className="reorder-phon">{part[1]}</span>
                            <span className="reorder-my" lang="my">
                              {part[2]}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="muted">စကားလုံးအားလုံး စီပြီးပါပြီ။</span>
                    )}
                  </div>
                </div>

                {/* Status / Feedback */}
                {reorderChecked && (
                  <div>
                    {rearrangeCorrect ? (
                      <div>
                        <div className="reorder-status good" role="status">
                          <strong>✅ မှန်ပါတယ်!</strong> စာကြောင်းကို မှန်ကန်စွာ စီထားပါတယ်။
                        </div>
                        <div className="reorder-complete">
                          <div className="thai" lang="th">
                            {currentRearrange.parts.map((p) => p[0]).join('')}
                          </div>
                          <div className="phonetic">
                            {'/' +
                              currentRearrange.parts
                                .map((p) => p[1].replaceAll('/', ''))
                                .join('-') +
                              '/'}
                          </div>
                          <div className="mm" lang="my">
                            {currentRearrange.meaning}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="reorder-status try" role="status">
                        အစီအစဉ် မမှန်သေးပါ။ စကားလုံးကို နှိပ်ပြီး ပြန်ရွှေ့နိုင်ပါတယ်။
                      </div>
                    )}
                  </div>
                )}

                <div className="reorder-controls">
                  <button className="btn secondary" onClick={resetRearranged}>
                    ↺ ပြန်စီရန်
                  </button>
                  {rearrangeCorrect ? (
                    <button className="btn" onClick={nextRearranged}>
                      {reorderIndex === rearrangeLessons.length - 1
                        ? 'နောက်တစ်ကြိမ် လေ့ကျင့်ရန်'
                        : 'နောက်ဝါကျ →'}
                    </button>
                  ) : (
                    <button
                      className="btn"
                      onClick={checkRearranged}
                      disabled={!rearrangeComplete}
                    >
                      ✓ အဖြေစစ်ရန်
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= SETTINGS PAGE ======================= */}
        {page === 'settings' && (
          <div>
            <h2>⚙️ အသံနှင့် app settings</h2>
            <div className="card">
              <h3>Thai voice · အသံ</h3>
              <p className="muted">
                Thai voice selection depends on the browser and operating system.
              </p>
              <div className="notice" style={{ margin: '12px 0' }}>
                {availableVoices
                  .filter((x) => x.lang.toLowerCase().startsWith('th'))
                  .map((x) => `${x.name} (${x.lang})`)
                  .join(', ') || 'No Thai voice is currently detected on this device.'}
              </div>

              <label htmlFor="rate" style={{ display: 'block', margin: '12px 0 6px', fontWeight: 600 }}>
                Audio speed · <span>{speed.toFixed(2)}</span>×
              </label>
              <input
                id="rate"
                type="range"
                min="0.5"
                max="1.1"
                step="0.05"
                value={speed}
                style={{ width: '100%', accentColor: '#511368' }}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSpeed(val);
                  localStorage.setItem('thaiSpeed', val.toString());
                }}
              />

              <div className="controls">
                <button className="btn" onClick={() => speak('สวัสดีครับ')}>
                  🔊 Test Thai voice
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Install on phone</h3>
              <p className="muted">
                Open the hosted site in Chrome on Android or Safari on iPhone, then use Add to Home Screen / Install App.
              </p>
              <p className="small muted" style={{ marginTop: '8px' }}>
                A PWA needs HTTPS or localhost. The current downloaded HTML file can be opened as a preview, but installation and offline caching require hosting.
              </p>
            </div>

            <div className="card">
              <h3>Student progress</h3>
              <p className="muted">
                Saved on this device, not synchronized with a school account.
              </p>
              <button
                className="btn secondary"
                style={{ marginTop: '12px' }}
                onClick={() => {
                  if (window.confirm('Reset your progress?')) {
                    setDoneList([]);
                    localStorage.removeItem('thaiDoneUnit2V4');
                  }
                }}
              >
                Reset progress
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Fixed Navigation Bar */}
      <nav className="nav" id="nav">
        <button
          className={page === 'home' ? 'active' : ''}
          onClick={() => handleNavigate('home')}
        >
          <span className="ico">⌂</span>
          <span>ပင်မ</span>
        </button>
        <button
          className={page === 'learn' ? 'active' : ''}
          onClick={() => handleNavigate('learn')}
        >
          <span className="ico">◉</span>
          <span>လေ့လာ</span>
        </button>
        <button
          className={page === 'practice' ? 'active' : ''}
          onClick={() => handleNavigate('practice')}
        >
          <span className="ico">✦</span>
          <span>လေ့ကျင့်</span>
        </button>
        <button
          className={page === 'flash' ? 'active' : ''}
          onClick={() => handleNavigate('flash')}
        >
          <span className="ico">▣</span>
          <span>ကတ်များ</span>
        </button>
        <button
          className={page === 'settings' ? 'active' : ''}
          onClick={() => handleNavigate('settings')}
        >
          <span className="ico">⚙</span>
          <span>ချိန်ညှိ</span>
        </button>
      </nav>
    </div>
  );
}
