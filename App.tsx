
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LOGIC_QUESTIONS, EXAM_TIME_LIMIT } from './constants';
import { ExamStep, ExamResponse, ProctorLog } from './types';
import CameraProctor, { CameraProctorHandle } from './components/CameraProctor';

const App: React.FC = () => {
  const [step, setStep] = useState<ExamStep>(ExamStep.EXPLANATION);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ExamResponse[]>([]);
  const [proctorLogs, setProctorLogs] = useState<ProctorLog[]>([]);
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME_LIMIT);
  const [isViolationAlert, setIsViolationAlert] = useState(false);
  const [violationType, setViolationType] = useState<'AI' | 'TAB'>('AI');
  const [selectedLog, setSelectedLog] = useState<ProctorLog | null>(null);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  
  const proctorRef = useRef<CameraProctorHandle>(null);

  // Tab Monitoring Logic
  useEffect(() => {
    if (step !== ExamStep.TESTING) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.warn("[System] Visibility Change Detected: Hidden");
        handleTabViolation("User switched tabs or minimized window.");
      }
    };

    const handleBlur = () => {
      console.warn("[System] Window Blur Detected");
      handleTabViolation("Window lost focus (User might be using another application).");
    };

    const handleTabViolation = (msg: string) => {
      console.log("[App] Recording Tab Violation:", msg);
      setViolationType('TAB');
      setIsViolationAlert(true);
      proctorRef.current?.takeSnapshot(msg, 'TAB_SWITCH');
      setTimeout(() => setIsViolationAlert(false), 5000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [step]);

  // Question Navigation
  const handleNext = useCallback(() => {
    if (currentIndex < LOGIC_QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTimeLeft(EXAM_TIME_LIMIT);
    } else {
      setStep(ExamStep.SUMMARY);
    }
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setTimeLeft(EXAM_TIME_LIMIT);
    }
  }, [currentIndex]);

  const goToQuestion = (index: number) => {
    setCurrentIndex(index);
    setTimeLeft(EXAM_TIME_LIMIT);
    setIsNavigatorOpen(false);
  };

  useEffect(() => {
    if (step !== ExamStep.TESTING) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleNext();
          return EXAM_TIME_LIMIT;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, handleNext]);

  const handleAnswer = (optionIndex: number) => {
    const isCorrect = optionIndex === LOGIC_QUESTIONS[currentIndex].correctAnswer;
    const currentFlag = responses.find(r => r.questionId === LOGIC_QUESTIONS[currentIndex].id)?.flagged;
    
    const newResponse: ExamResponse = {
      questionId: LOGIC_QUESTIONS[currentIndex].id,
      selectedOption: optionIndex,
      isCorrect,
      flagged: currentFlag
    };

    setResponses(prev => {
      const existing = prev.filter(r => r.questionId !== LOGIC_QUESTIONS[currentIndex].id);
      return [...existing, newResponse];
    });
  };

  const toggleFlag = () => {
    const qId = LOGIC_QUESTIONS[currentIndex].id;
    setResponses(prev => {
      const existing = prev.find(r => r.questionId === qId);
      if (existing) {
        return prev.map(r => r.questionId === qId ? { ...r, flagged: !r.flagged } : r);
      } else {
        return [...prev, { questionId: qId, selectedOption: null, isCorrect: false, flagged: true }];
      }
    });
  };

  const handleProctorViolation = (log: ProctorLog) => {
    console.log("[App] Committing Proctor Log:", log);
    setProctorLogs(prev => [...prev, log]);
    if (log.status !== 'TAB_SWITCH') {
      setViolationType('AI');
      setIsViolationAlert(true);
      setTimeout(() => setIsViolationAlert(false), 3000);
    }
  };

  const calculateScore = () => responses.filter(r => r.isCorrect).length;

  const isAnswered = (id: number) => responses.some(r => r.questionId === id && r.selectedOption !== null);
  const isFlagged = (id: number) => responses.some(r => r.questionId === id && r.flagged);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display flex flex-col">
      
      {/* ----------------- EXPLANATION STEP ----------------- */}
      {step === ExamStep.EXPLANATION && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center gap-3 text-primary mb-6">
              <span className="material-symbols-outlined text-4xl">school</span>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Quantitative Reasoning</h1>
            </div>
            <div className="space-y-6 text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
              <p>Welcome to the Mid-Term Assessment. Please accept the proctoring terms:</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-1">videocam</span>
                  <span>AI Proctoring will monitor your presence and environment.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-rose-500 mt-1">tab</span>
                  <span><strong>Tab switching is strictly prohibited</strong> and will trigger an immediate snapshot log.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400 mt-1">timer</span>
                  <span>Each question has a 30-second window. Answers are saved automatically.</span>
                </li>
              </ul>
            </div>
            <button 
              onClick={() => setStep(ExamStep.TESTING)}
              className="mt-10 w-full bg-primary hover:bg-primary/90 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 text-xl"
            >
              Start Assessment
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* ----------------- TESTING STEP ----------------- */}
      {step === ExamStep.TESTING && (
        <>
          {/* Header */}
          <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-6">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-2xl md:text-3xl">school</span>
                  <h1 className="text-sm md:text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">Mid-Term Assessment</h1>
                </div>
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">Module</span>
                  <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-slate-200">Quantitative Reasoning</span>
                </div>
              </div>
              <div className="flex items-center gap-4 md:gap-8">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progress</span>
                  <span className="text-sm font-bold text-primary">Question {currentIndex + 1} of {LOGIC_QUESTIONS.length}</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3 bg-primary/10 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-sm md:text-base">timer</span>
                  <span className={`text-sm md:text-lg font-mono font-bold text-primary ${timeLeft < 10 ? 'animate-pulse text-rose-600' : ''}`}>
                    00:{timeLeft.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
            {/* Simple Progress Bar (Desktop Sidebar & Mobile Header) */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${((currentIndex + 1) / LOGIC_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </header>

          <main className="flex-grow max-w-[1440px] mx-auto w-full px-4 md:px-6 py-4 md:py-8 flex flex-col lg:flex-row gap-8">
            {/* Main Question Area */}
            <div className="flex-grow flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                  <div className="flex items-center justify-between mb-6">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest border border-primary/20">
                      Question {String(currentIndex + 1).padStart(2, '0')}
                    </span>
                    <button 
                      onClick={toggleFlag}
                      className={`flex items-center gap-2 transition-colors ${isFlagged(LOGIC_QUESTIONS[currentIndex].id) ? 'text-amber-600' : 'text-slate-400 hover:text-amber-500'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: isFlagged(LOGIC_QUESTIONS[currentIndex].id) ? "'FILL' 1" : "'FILL' 0" }}>flag</span>
                      <span className="text-sm font-bold">Flag for Review</span>
                    </button>
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white leading-relaxed">
                    {LOGIC_QUESTIONS[currentIndex].text}
                  </h2>
                </div>
                <div className="p-6 md:p-8 space-y-3">
                  {LOGIC_QUESTIONS[currentIndex].options.map((option, idx) => {
                    const isSelected = responses.find(r => r.questionId === LOGIC_QUESTIONS[currentIndex].id)?.selectedOption === idx;
                    return (
                      <label key={idx} className="relative flex cursor-pointer group">
                        <input 
                          type="radio" 
                          name="answer" 
                          className="peer hidden" 
                          checked={isSelected}
                          onChange={() => handleAnswer(idx)}
                        />
                        <div className="w-full p-4 md:p-5 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-primary/50 transition-all flex items-center gap-4 peer-checked:border-primary peer-checked:bg-primary/5">
                          <span className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-200 dark:border-slate-700 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white text-slate-500 font-bold text-sm md:text-base group-hover:bg-primary/10 transition-colors">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-base md:text-lg text-slate-800 dark:text-slate-200 font-medium">{option}</span>
                          {isSelected && (
                            <span className="material-symbols-outlined text-primary ml-auto">check_circle</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Question Navigator Trigger */}
              <div className="lg:hidden mt-2 flex justify-center">
                <button 
                  onClick={() => setIsNavigatorOpen(true)}
                  className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/5 hover:bg-primary/10 px-6 py-3 rounded-full border border-primary/20 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">grid_view</span>
                  View Question Navigator
                </button>
              </div>

              {/* Footer Controls (Desktop Layout mimics Footer) */}
              <div className="hidden lg:flex items-center justify-between mt-auto pt-6">
                <button 
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-30"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                  Previous Question
                </button>
                <button 
                  onClick={handleNext}
                  className="px-10 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                >
                  {currentIndex === LOGIC_QUESTIONS.length - 1 ? 'Finish Assessment' : 'Next Question'}
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Sidebar Navigation (Desktop) */}
            <aside className="hidden lg:flex w-80 flex-shrink-0 flex-col gap-6 sticky top-28 h-fit">
              <CameraProctor 
                ref={proctorRef}
                isActive={true} 
                onViolation={handleProctorViolation}
              />

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-widest">
                  <span className="material-symbols-outlined text-primary text-xl">grid_view</span>
                  Question Navigator
                </h3>
                <div className="grid grid-cols-5 gap-3 mb-8">
                  {LOGIC_QUESTIONS.map((q, i) => {
                    const answered = isAnswered(q.id);
                    const flagged = isFlagged(q.id);
                    const current = currentIndex === i;
                    
                    return (
                      <button 
                        key={q.id}
                        onClick={() => goToQuestion(i)}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-xs relative transition-all hover:scale-105 ${
                          current ? 'border-2 border-primary bg-primary/10 text-primary' :
                          flagged ? 'border border-amber-400 bg-amber-50 text-amber-600' :
                          answered ? 'bg-emerald-500 text-white shadow-sm' :
                          'border border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        {i + 1}
                        {flagged && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                    <div className="w-3 h-3 rounded bg-emerald-500"></div> <span>Answered</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                    <div className="w-3 h-3 rounded border-2 border-primary bg-primary/10"></div> <span>Current</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                    <div className="w-3 h-3 rounded bg-amber-500"></div> <span>Flagged</span>
                  </div>
                </div>
              </div>
            </aside>
          </main>

          {/* Bottom Navigation Bar (Mobile) */}
          <footer className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex gap-4 items-center z-40">
            <button 
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold transition-all disabled:opacity-30"
            >
              <span className="material-symbols-outlined">chevron_left</span>
              Prev
            </button>
            <button 
              onClick={handleNext}
              className="flex-[2] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 transition-all"
            >
              {currentIndex === LOGIC_QUESTIONS.length - 1 ? 'Finish' : 'Next Question'}
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </footer>

          {/* Navigator Mobile Drawer */}
          {isNavigatorOpen && (
            <>
              <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-in fade-in"
                onClick={() => setIsNavigatorOpen(false)}
              ></div>
              <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-[2rem] z-[60] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6"></div>
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white">Question Navigator</h4>
                  <button onClick={() => setIsNavigatorOpen(false)} className="text-slate-400 p-2"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="grid grid-cols-5 gap-4 mb-8">
                  {LOGIC_QUESTIONS.map((q, i) => (
                    <button 
                      key={q.id}
                      onClick={() => goToQuestion(i)}
                      className={`aspect-square flex items-center justify-center rounded-xl font-bold text-sm ${
                        currentIndex === i ? 'border-2 border-primary bg-primary/10 text-primary' :
                        isFlagged(q.id) ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                        isAnswered(q.id) ? 'bg-emerald-500 text-white' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="flex gap-6 justify-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500"></span> Answered</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/10 border border-primary"></span> Current</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500"></span> Flagged</div>
                </div>
              </div>
            </>
          )}

          {/* Floating Camera for Mobile */}
          <div className="lg:hidden fixed bottom-24 right-4 w-28 h-36 z-30 opacity-80 hover:opacity-100 transition-opacity">
            <CameraProctor ref={proctorRef} isActive={true} onViolation={handleProctorViolation} />
          </div>
        </>
      )}

      {/* ----------------- SUMMARY STEP ----------------- */}
      {step === ExamStep.SUMMARY && (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 p-6 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-8">Integrity Audit Report</h1>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
              <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                <p className="text-primary font-bold text-xs uppercase mb-1">Total Score</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{calculateScore()} / {LOGIC_QUESTIONS.length}</p>
              </div>
              <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
                <p className="text-emerald-600 font-bold text-xs uppercase mb-1">Accuracy</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{Math.round((calculateScore() / LOGIC_QUESTIONS.length) * 100)}%</p>
              </div>
              <div className="bg-amber-500/5 p-6 rounded-3xl border border-amber-500/10">
                <p className="text-amber-600 font-bold text-xs uppercase mb-1">AI Alerts</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{proctorLogs.filter(l => l.status !== 'TAB_SWITCH').length}</p>
              </div>
              <div className="bg-rose-500/5 p-6 rounded-3xl border border-rose-500/10">
                <p className="text-rose-600 font-bold text-xs uppercase mb-1">Tab Alerts</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{proctorLogs.filter(l => l.status === 'TAB_SWITCH').length}</p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Examination Timeline
            </h3>
            
            <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Time</th>
                    <th className="p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Incident</th>
                    <th className="p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">AI Result</th>
                    <th className="p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {proctorLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400 italic">No security incidents detected. Verified Clean Session.</td>
                    </tr>
                  ) : (
                    proctorLogs.sort((a,b) => b.timestamp - a.timestamp).map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-xs font-mono text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                            log.status === 'TAB_SWITCH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs">{log.message}</td>
                        <td className="p-4">
                          <button onClick={() => setSelectedLog(log)} className="relative group rounded-lg overflow-hidden block">
                            <img src={log.snapshot} className="w-16 h-10 object-cover border border-slate-200" />
                            <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </div>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-12 flex justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="px-10 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold rounded-2xl transition-all hover:scale-105"
              >
                Retake Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT OVERLAY */}
      {isViolationAlert && (
        <div className="fixed top-24 right-4 md:right-8 z-[70] animate-in slide-in-from-right duration-500">
          <div className={`${violationType === 'TAB' ? 'bg-rose-600' : 'bg-amber-600'} text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm border-4 border-white dark:border-slate-800`}>
             <span className="material-symbols-outlined text-3xl animate-bounce">warning</span>
             <div>
               <p className="font-black text-xs uppercase tracking-widest">Security Alert</p>
               <p className="text-xs opacity-90">{violationType === 'TAB' ? 'Tab switch detected and logged.' : 'AI detected suspicious movement.'}</p>
             </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedLog && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden border-8 border-white dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <img src={selectedLog.snapshot} className="w-full aspect-video object-cover" />
            <div className="p-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black">Snapshot Evidence</h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                <div className="px-6 py-2 bg-rose-600 text-white font-black text-xs rounded-full uppercase tracking-widest">{selectedLog.status}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 italic text-slate-700 dark:text-slate-300">
                "{selectedLog.message}"
              </div>
              <button onClick={() => setSelectedLog(null)} className="mt-8 w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold rounded-2xl">Close Evidence View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
