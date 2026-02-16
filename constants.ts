
import { Question } from './types';

export const LOGIC_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely Lazzies.",
    options: ["True", "False"],
    correctAnswer: 0
  },
  {
    id: 2,
    text: "Which number should come next in the sequence: 2, 6, 18, 54, ...?",
    options: ["108", "148", "162", "216"],
    correctAnswer: 2
  },
  {
    id: 3,
    text: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?",
    options: ["$0.10", "$0.05", "$0.15", "$0.01"],
    correctAnswer: 1
  },
  {
    id: 4,
    text: "If five machines can make 5 widgets in 5 minutes, how many minutes does it take 100 machines to make 100 widgets?",
    options: ["100 minutes", "50 minutes", "5 minutes", "1 minute"],
    correctAnswer: 2
  },
  {
    id: 5,
    text: "In a lake, there is a patch of lily pads. Every day, the patch doubles in size. If it takes 48 days for the patch to cover the entire lake, how many days would it take for the patch to cover half the lake?",
    options: ["24 days", "47 days", "12 days", "40 days"],
    correctAnswer: 1
  },
  {
    id: 6,
    text: "Which word does not belong in the following list: Apple, Banana, Carrot, Grape?",
    options: ["Apple", "Banana", "Carrot", "Grape"],
    correctAnswer: 2
  },
  {
    id: 7,
    text: "If you rearrange the letters 'CIFAIPC', you would get the name of an:",
    options: ["Ocean", "Country", "State", "City"],
    correctAnswer: 0
  },
  {
    id: 8,
    text: "Sally is 54 years old and her mother is 80. How many years ago was her mother 3 times her age?",
    options: ["30 years", "41 years", "40 years", "35 years"],
    correctAnswer: 1
  },
  {
    id: 9,
    text: "A boy has as many sisters as brothers, but each sister has only half as many sisters as brothers. How many brothers are there?",
    options: ["3", "4", "5", "6"],
    correctAnswer: 1
  },
  {
    id: 10,
    text: "What is the next prime number after 7?",
    options: ["9", "10", "11", "13"],
    correctAnswer: 2
  }
];

export const EXAM_TIME_LIMIT = 120; // 2 Minutes total for the category
export const PROCTOR_CHECK_INTERVAL = 5000; // 5 seconds
