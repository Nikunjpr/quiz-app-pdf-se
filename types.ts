export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export type AppState = 'setup' | 'generating' | 'quiz' | 'review' | 'results';

// This is to inform TypeScript that these libraries are available globally from the CDN
declare global {
  const pdfjsLib: any;
  const mammoth: any;
}
