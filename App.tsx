
import React, { useState, useEffect, useCallback } from 'react';
import { LOGIC_QUESTIONS, EXAM_TIME_LIMIT } from './constants';
import { ExamStep, ExamResponse, ProctorLog } from './types';
import CameraProctor from './components/CameraProctor';

const App: React.FC = () => {
  const [step, setStep] = useState<ExamStep>(ExamStep.EXPLANATION);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ExamResponse[]>([]);
  const [proctorLogs, setProctorLogs] = useState<ProctorLog[]>([]);
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME_LIMIT);
  const [isViolationAlert, setIsViolationAlert] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ProctorLog | null>(null);

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
    setProctorLogs(prev => [...prev, log]);
    setIsViolationAlert(true);
    setTimeout(() => setIsViolationAlert(false), 3000);
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
                <li>Ensure you are in a well-lit area and remain alone in the frame.</li>
                <li>Your presence will be monitored by the Gemini AI throughout the duration of the test.</li>
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
            {/* Left: Question Area */}
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

            {/* Right: Proctoring Area */}
            <div className="lg:col-span-4 sticky top-8 space-y-6">
              <CameraProctor 
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
                    <span className="text-slate-500">Live Feedback</span>
                    <span className="text-green-600 font-bold">OPTIMAL</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">AI Alerts</span>
                    <span className="text-slate-900 font-bold">{proctorLogs.length} logged</span>
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
              <span className="ml-4 text-sm font-normal text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
              </span>
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <p className="text-blue-600 font-bold text-sm uppercase mb-1">Total Score</p>
                <p className="text-4xl font-black text-blue-900">{calculateScore()} / {LOGIC_QUESTIONS.length}</p>
              </div>
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                <p className="text-emerald-600 font-bold text-sm uppercase mb-1">Accuracy</p>
                <p className="text-4xl font-black text-emerald-900">{Math.round((calculateScore() / LOGIC_QUESTIONS.length) * 100)}%</p>
              </div>
              <div className={`p-6 rounded-2xl border ${proctorLogs.length > 3 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`${proctorLogs.length > 3 ? 'text-red-600' : 'text-slate-500'} font-bold text-sm uppercase mb-1`}>Proctor Alerts</p>
                <p className={`text-4xl font-black ${proctorLogs.length > 3 ? 'text-red-900' : 'text-slate-900'}`}>{proctorLogs.length}</p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-6">Proctoring Timeline</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">Timestamp</th>
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">Status</th>
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">AI Observation</th>
                    <th className="pb-4 font-bold text-slate-500 uppercase text-xs tracking-wider">Visual Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proctorLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">No proctoring violations detected. Excellent conduct.</td>
                    </tr>
                  ) : (
                    proctorLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 text-sm font-mono text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                            log.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-slate-600 pr-4">
                          {log.message}
                        </td>
                        <td className="py-4">
                          {log.snapshot && (
                            <button 
                              onClick={() => setSelectedLog(log)}
                              className="group relative inline-block focus:outline-none focus:ring-4 focus:ring-blue-100 rounded-lg transition-transform hover:scale-105 active:scale-95"
                            >
                              <img 
                                src={log.snapshot} 
                                alt="Violation snapshot" 
                                className="w-16 h-10 object-cover rounded shadow-sm border border-slate-200 transition-shadow group-hover:shadow-md"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
                className="text-slate-500 hover:text-slate-800 font-bold py-2 px-6 transition-colors"
              >
                Retake Examination
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Alert for Proctoring Violations during Exam */}
      {isViolationAlert && (
        <div className="fixed top-8 right-8 z-50 animate-in slide-in-from-right duration-300">
          <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center space-x-3 max-w-sm">
            <div className="bg-white/20 p-2 rounded-full">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-bold">AI Alert Triggered</p>
              <p className="text-xs text-white/80">Proctoring flag added to your final report.</p>
            </div>
          </div>
        </div>
      )}

      {/* Violation Detail Modal */}
      {selectedLog && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img 
                src={selectedLog.snapshot} 
                alt="Enlarged violation view" 
                className="w-full h-auto aspect-video object-cover"
              />
              <button 
                onClick={() => setSelectedLog(null)}
                className="absolute top-6 right-6 p-3 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full transition-colors text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-8 md:p-10">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Incident Analysis</h2>
                  <p className="text-slate-500 font-medium">Recorded at {new Date(selectedLog.timestamp).toLocaleTimeString()} ({new Date(selectedLog.timestamp).toLocaleDateString()})</p>
                </div>
                <div className={`px-6 py-2 rounded-full font-bold text-sm tracking-wide ${
                  selectedLog.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {selectedLog.status} PRIORITY
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">AI Observation</p>
                <p className="text-xl text-slate-800 font-medium leading-relaxed">
                  "{selectedLog.message}"
                </p>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Close Detail
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
