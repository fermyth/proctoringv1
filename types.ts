
export interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
}

export interface ExamResponse {
  questionId: number;
  selectedOption: number | null;
  isCorrect: boolean;
  flagged?: boolean;
}

export interface ProctorLog {
  timestamp: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL' | 'TAB_SWITCH';
  message: string;
  snapshot?: string;
}

export enum ExamStep {
  EXPLANATION = 'EXPLANATION',
  TESTING = 'TESTING',
  SUMMARY = 'SUMMARY'
}
