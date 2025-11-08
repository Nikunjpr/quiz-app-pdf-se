import React, { useState, useCallback } from 'react';
import { QuizQuestion, AppState } from './types';
import QuizSetup from './components/QuizSetup';
import QuizView from './components/QuizView';
import QuizResults from './components/QuizResults';
import QuizReview from './components/QuizReview';
import Spinner from './components/Spinner';
import { generateQuizFromText } from './services/geminiService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('setup');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timerDuration, setTimerDuration] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const handleQuizGenerate = useCallback(async (file: File, numQuestions: number, duration: number) => {
    setAppState('generating');
    setError(null);
    try {
      const fileText = await extractTextFromFile(file);
      const trimmedText = fileText.trim();
      if (trimmedText.length < 100) {
        const snippet = trimmedText.substring(0, 100);
        throw new Error(`Document content is too short (${trimmedText.length} characters) to generate a meaningful quiz. This can happen if the document is very brief or is image-based from which text cannot be extracted.\n\nExtracted text snippet: "${snippet}..."`);
      }
      const questions = await generateQuizFromText(fileText, numQuestions);
      setQuizQuestions(questions);
      setUserAnswers(new Array(questions.length).fill(''));
      setTimerDuration(duration);
      setCurrentQuestionIndex(0);
      setAppState('quiz');
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while generating the quiz.';
      setError(errorMessage);
      setAppState('setup');
    }
  }, []);
  
  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            if (!event.target?.result) {
                return reject(new Error("Failed to read file."));
            }
            try {
                const arrayBuffer = event.target.result as ArrayBuffer;
                let fullText = '';

                if (extension === 'pdf') {
                    const typedarray = new Uint8Array(arrayBuffer);
                    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((s: any) => s.str).join(' ');
                        fullText += pageText + '\n\n';
                    }
                } else if (extension === 'docx' || extension === 'doc') {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    fullText = result.value;
                } else {
                    return reject(new Error('Unsupported file type. Please upload a PDF, DOC, or DOCX file.'));
                }
                
                resolve(fullText);

            } catch (error) {
                console.error(`Error parsing ${extension?.toUpperCase()}:`, error);
                if (extension === 'pdf') {
                    reject(new Error("Failed to parse the PDF. It might be corrupted, password-protected, or in an unsupported format."));
                } else {
                    reject(new Error("Failed to parse the Word document. It might be corrupted or password-protected."));
                }
            }
        };
        fileReader.onerror = () => {
          console.error("File reading error:", fileReader.error);
          reject(new Error("An error occurred while reading the file."));
        };
        fileReader.readAsArrayBuffer(file);
    });
  };

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };
  
  const handleQuizFinish = () => {
    setAppState('review');
  };

  const handleFinalSubmit = () => {
    setAppState('results');
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setAppState('quiz');
  };

  const handleRetry = () => {
    setQuizQuestions([]);
    setUserAnswers([]);
    setCurrentQuestionIndex(0);
    setError(null);
    setAppState('setup');
  };

  const renderContent = () => {
    switch (appState) {
      case 'generating':
        return <div className="flex flex-col items-center justify-center h-full"><Spinner /><p className="mt-4 text-slate-600 dark:text-slate-300">Generating your quiz... this may take a moment.</p></div>;
      case 'quiz':
        return (
          <QuizView
            questions={quizQuestions}
            question={quizQuestions[currentQuestionIndex]}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={quizQuestions.length}
            selectedAnswer={userAnswers[currentQuestionIndex]}
            onAnswerSelect={handleAnswerSelect}
            onNext={handleNextQuestion}
            onPrev={handlePrevQuestion}
            onFinish={handleQuizFinish}
            timerDuration={timerDuration}
          />
        );
      case 'review':
        return (
          <QuizReview
            questions={quizQuestions}
            userAnswers={userAnswers}
            onFinalSubmit={handleFinalSubmit}
            onJumpToQuestion={handleJumpToQuestion}
          />
        );
      case 'results':
        return (
          <QuizResults
            questions={quizQuestions}
            userAnswers={userAnswers}
            onRetry={handleRetry}
            timerDuration={timerDuration}
          />
        );
      case 'setup':
      default:
        return <QuizSetup onGenerate={handleQuizGenerate} error={error} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      <div className="w-full max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-sky-600 dark:text-sky-400">Quiz Generator</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 mt-2">Transform any document into an interactive quiz instantly.</p>
        </header>
        <main className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 md:p-10 min-h-[400px] flex flex-col justify-center">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;