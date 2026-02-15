
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
  
  const proctorRef = useRef<CameraProctorHandle>(null);

  // Tab Monitoring Logic
  useEffect(() => {
    if (step !== ExamStep.TESTING) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.warn("[System] Visibility Change Detected: Hidden");
        const msg = "User switched tabs or minimized window.";
        handleTabViolation(msg);
      } else {
        console.log("[System] Visibility Change Detected: Visible");
      }
    };

    const handleBlur = () => {
      console.warn("[System] Window Blur Detected");
      const msg = "Window lost focus (User might be using another application).";
      handleTabViolation(msg);
    };

    const handleFocus = () => {
      console.log("[System] Window Focus Restored");
    };

    const handleTabViolation = (msg: string) => {
      console.log("[App] Recording Tab Violation:", msg);
      setViolationType('TAB');
      setIsViolationAlert(true);
      
      // Request snapshot immediately
      proctorRef.current?.takeSnapshot(msg, 'TAB_SWITCH');
      
      setTimeout(() => setIsViolationAlert(false), 5000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [step]);

  const handleNext = useCallback(() => {
    if (currentIndex < LOGIC_QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTimeLeft(EXAM_TIME_LIMIT);
    } else {
      setStep(ExamStep.SUMMARY);
    }
  }, [currentIndex]);

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
    const newResponse: ExamResponse = {
      questionId: LOGIC_QUESTIONS[currentIndex].id,
      selectedOption: optionIndex,
      isCorrect
    };

    setResponses(prev => {
      const existing = prev.filter(r => r.questionId !== LOGIC_QUESTIONS[currentIndex].id);
      return [...existing, newResponse];
    });

    // Auto-advance
    setTimeout(handleNext, 300);
  };

  const handleProctorViolation = (log: ProctorLog) => {
    console.log("[App] Committing Proctor Log to State:", log);
    setProctorLogs(prev => [...prev, log]);
    
    if (log.status !== 'TAB_SWITCH') {
      setViolationType('AI');
      setIsViolationAlert(true);
      setTimeout(() => setIsViolationAlert(false), 3000);
    }
  };

  const calculateScore = () => {
    return responses.filter(r => r.isCorrect).length;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-5xl">
        {step === ExamStep.EXPLANATION && (
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-500">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Logic Examination Portal
            </h1>
            <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
              <p>Welcome to the proctored assessment. Please read the following instructions carefully before proceeding:</p>
              <ul className="list-disc pl-6 space-y-3">
                <li>This test contains <span className="font-bold text-slate-900">10 logic problems</span>.</li>
                <li>You have exactly <span className="font-bold text-slate-900">30 seconds</span> per question.</li>
                <li>The camera will be active for <span className="font-bold text-slate-900">real-time AI proctoring</span>.</li>
                <li><span className="text-red-600 font-bold underline">Tab switching is strictly prohibited</span> and will be logged with a photo.</li>
                <li>Ensure you are in a well-lit area and remain alone in the frame.</li>
              </ul>
            </div>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setStep(ExamStep.TESTING)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-200"
              >
                Accept & Start Exam
              </button>
            </div>
          </div>
        )}

        {step === ExamStep.TESTING && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative min-h-[400px] flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-8">
                    <span className="px-4 py-1.5 bg-blue-50 text-blue-700 text-sm font-bold rounded-full">
                      Question {currentIndex + 1} of {LOGIC_QUESTIONS.length}
                    </span>
                    <div className="flex items-center space-x-2 text-slate-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`font-mono text-xl font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                        00:{timeLeft.toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-2xl font-semibold text-slate-800 mb-10 leading-snug">
                    {LOGIC_QUESTIONS[currentIndex].text}
                  </h2>

                  <div className="grid grid-cols-1 gap-4">
                    {LOGIC_QUESTIONS[currentIndex].options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(idx)}
                        className="group flex items-center p-5 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center font-bold text-slate-500 mr-4 transition-colors">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-lg text-slate-700 font-medium group-hover:text-blue-900">{option}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300" 
                    style={{ width: `${((currentIndex + 1) / LOGIC_QUESTIONS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 sticky top-8 space-y-6">
              <CameraProctor 
                ref={proctorRef}
                isActive={true} 
                onViolation={handleProctorViolation}
              />
              
              <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  Proctor Status
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Focus Status</span>
                    <span className="text-green-600 font-bold uppercase">Locked</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Incident Logs</span>
                    <span className="text-slate-900 font-bold">{proctorLogs.length} total</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === ExamStep.SUMMARY && (
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-slate-100 animate-in slide-in-from-bottom duration-700">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-8 flex items-center">
              Examination Report
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <p className="text-blue-600 font-bold text-sm uppercase mb-1">Score</p>
                <p className="text-3xl font-black text-blue-900">{calculateScore()} / {LOGIC_QUESTIONS.length}</p>
              </div>
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                <p className="text-emerald-600 font-bold text-sm uppercase mb-1">Accuracy</p>
                <p className="text-3xl font-black text-emerald-900">{Math.round((calculateScore() / LOGIC_QUESTIONS.length) * 100)}%</p>
              </div>
              <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                <p className="text-amber-600 font-bold text-sm uppercase mb-1">AI Alerts</p>
                <p className="text-3xl font-black text-amber-900">{proctorLogs.filter(l => l.status !== 'TAB_SWITCH').length}</p>
              </div>
              <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
                <p className="text-rose-600 font-bold text-sm uppercase mb-1">Tab Activity</p>
                <p className="text-3xl font-black text-rose-900">{proctorLogs.filter(l => l.status === 'TAB_SWITCH').length}</p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Activity Timeline
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">Time</th>
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">Type</th>
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">Observation</th>
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proctorLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">Integrity verification passed. No incidents recorded.</td>
                    </tr>
                  ) : (
                    proctorLogs.sort((a,b) => b.timestamp - a.timestamp).map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 text-sm font-mono text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                            log.status === 'TAB_SWITCH' ? 'bg-rose-100 text-rose-700' : 
                            log.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-slate-600 pr-4 max-w-md">
                          {log.message}
                        </td>
                        <td className="py-4">
                          {log.snapshot && (
                            <button 
                              onClick={() => setSelectedLog(log)}
                              className="group relative inline-block focus:outline-none rounded-lg transition-all hover:scale-110"
                            >
                              <img 
                                src={log.snapshot} 
                                alt="Snapshot" 
                                className="w-16 h-10 object-cover rounded shadow-sm border border-slate-200"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </div>
                            </button>
                          )}
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
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-2xl transition-all"
              >
                Exit & Reset Session
              </button>
            </div>
          </div>
        )}
      </div>

      {isViolationAlert && (
        <div className="fixed top-8 right-8 z-[60] animate-in slide-in-from-right duration-500">
          <div className={`${violationType === 'TAB' ? 'bg-rose-600' : 'bg-red-600'} text-white p-5 rounded-[2rem] shadow-2xl flex items-center space-x-4 max-w-sm border-4 border-white`}>
            <div className="bg-white/20 p-3 rounded-full animate-bounce">
              {violationType === 'TAB' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2v-9a2 2 0 00-2-2H8a2 2 0 00-2 2v9a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-black uppercase tracking-wider text-sm">Integrity Alert</p>
              <p className="text-xs text-white/90 leading-tight">
                {violationType === 'TAB' ? 'Unauthorized tab activity detected. Snapshot captured.' : 'Suspicious presence detected by AI proctor.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-8 border-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative group">
              <img 
                src={selectedLog.snapshot} 
                alt="Proctor evidence" 
                className="w-full h-auto aspect-video object-cover"
              />
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-8 left-10 text-white">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase border border-white/30">
                  Visual Evidence ID-{selectedLog.timestamp.toString().slice(-6)}
                </span>
              </div>
            </div>
            
            <div className="p-10">
              <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 mb-1">Incident Detail</h2>
                  <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                    Recorded at {new Date(selectedLog.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <div className={`px-8 py-3 rounded-2xl font-black text-sm tracking-widest uppercase ${
                  selectedLog.status === 'TAB_SWITCH' ? 'bg-rose-600 text-white' : 
                  selectedLog.status === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {selectedLog.status.replace('_', ' ')}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">System Observation</p>
                  <p className="text-lg text-slate-700 font-semibold leading-relaxed italic">
                    "{selectedLog.message}"
                  </p>
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all hover:scale-105"
                >
                  Confirm & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
