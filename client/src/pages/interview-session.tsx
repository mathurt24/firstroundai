import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { submitAnswer } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import AgoraCall from '../components/agora-call';
import { Textarea } from '@/components/ui/textarea';

interface InterviewData {
  interviewId: number;
  candidateId: number;
  questions: string[];
  currentQuestionIndex: number;
  candidateName?: string;
  candidateRole?: string;
  candidatePhone?: string;
}

export default function InterviewSession() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [latestFeedback, setLatestFeedback] = useState<string>('');
  const [answeredQuestions, setAnsweredQuestions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showCall, setShowCall] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false); // Track if user has joined the call
  const [answerDraft, setAnswerDraft] = useState('');
  const [interviewTerminated, setInterviewTerminated] = useState(false);
  const { logout, interviewBlocked, user } = useAuth();

  useEffect(() => {
    const stored = sessionStorage.getItem('currentInterview');
    if (stored) {
      const data = JSON.parse(stored);
      setInterviewData(data);
      setAnswers(data.questions.map(() => ''));
      // Check interview status
      fetch(`/api/interviews/${data.interviewId}`)
        .then(res => res.json())
        .then(res => {
          if (res.interview && res.interview.status === 'terminated') {
            setInterviewTerminated(true);
          }
        });
    } else {
      setLocation('/');
    }
  }, [setLocation]);

  useEffect(() => {
    setAnswerDraft(transcript);
  }, [transcript]);

  function startListening() {
    setSpeechError(null);
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setSpeechError('Speech recognition is not supported in this browser.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      setTranscript(event.results[0][0].transcript);
    };
    recognition.onerror = (event: any) => {
      setSpeechError(event.error || 'Speech recognition error');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  const handleAnswerSubmit = async (answerText: string) => {
    if (!interviewData) return;
    setIsSubmitting(true);
    try {
      const response = await submitAnswer({
        interviewId: interviewData.interviewId,
        questionIndex: interviewData.currentQuestionIndex,
        answerText
      });
      setCurrentScore(response.score);
      setLatestFeedback(response.feedback);
      setAnsweredQuestions(prev => [...new Set([...prev, interviewData.currentQuestionIndex])]);
      setAnswers(prev => {
        const updated = [...prev];
        updated[interviewData.currentQuestionIndex] = answerText;
        return updated;
      });
      toast({
        title: "Answer Submitted",
        description: `Score: ${response.score}/10 - ${response.feedback}`
      });
      if (response.completed) {
        sessionStorage.setItem('interviewResults', JSON.stringify({
          candidateId: interviewData.candidateId,
          interviewId: interviewData.interviewId,
          summary: response.summary
        }));
        toast({
          title: "Interview Complete!",
          description: "Redirecting to your results dashboard..."
        });
        setTimeout(() => {
          setLocation('/dashboard');
        }, 2000);
      } else {
        const updatedData = {
          ...interviewData,
          currentQuestionIndex: response.questionIndex!
        };
        setInterviewData(updatedData);
        sessionStorage.setItem('currentInterview', JSON.stringify(updatedData));
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit answer",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (!interviewData) return;
    handleAnswerSubmit("I would like to skip this question.");
  };

  const goToQuestion = (index: number) => {
    if (!interviewData) return;
    setInterviewData({ ...interviewData, currentQuestionIndex: index });
    sessionStorage.setItem('currentInterview', JSON.stringify({ ...interviewData, currentQuestionIndex: index }));
  };

  async function handleTerminateInterview() {
    if (interviewData) {
      try {
        await fetch(`/api/interviews/${interviewData.interviewId}/terminate`, { method: 'POST' });
      } catch {}
    }
    setInterviewTerminated(true);
    setTimeout(() => {
      logout();
    }, 2000);
  }

  if (interviewTerminated || interviewBlocked) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="text-2xl font-bold text-red-600 mb-4">Interview Blocked</div>
        <div className="text-gray-700 text-lg">You have left or forfeited your previous interview. You cannot continue or restart the interview.</div>
      </div>
    );
  }

  if (user?.role === 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="text-2xl font-bold text-red-600 mb-4">Access Denied</div>
        <div className="text-gray-700 text-lg">Admins cannot participate in interviews as candidates.</div>
      </div>
    );
  }

  if (!interviewData) {
    return <div>Loading...</div>;
  }

  const currentQuestion = interviewData.questions[interviewData.currentQuestionIndex];
  const progress = ((interviewData.currentQuestionIndex + 1) / interviewData.questions.length) * 100;
  const questionTypes = ['Technical', 'Technical', 'Technical', 'Technical', 'Behavioral'];

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-900">AI Interview in Progress</h2>
          <span className="text-sm text-gray-600">
            Question {interviewData.currentQuestionIndex + 1} of {interviewData.questions.length}
          </span>
        </div>
        <Progress value={progress} className="w-full h-2" />
      </div>
      {/* Current Question Display */}
      {showCall && joined && (
        <div className="mb-6 p-6 bg-gray-50 border rounded-lg max-w-4xl mx-auto">
          <div className="text-lg font-semibold text-primary mb-2">Question:</div>
          <div className="text-gray-900 text-base">{currentQuestion}</div>
        </div>
      )}
      {/* Agora Call and Answer UI */}
      <div className="mb-6 max-w-4xl mx-auto">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded mb-4"
          onClick={() => setShowCall((v) => !v)}
          disabled={joined} // Disable toggling call UI if already joined
        >
          {showCall ? 'Hide Interview Call' : 'Join Interview Call'}
        </button>
        {showCall && <AgoraCall setJoined={setJoined} joined={joined} onLeaveCall={handleTerminateInterview} />}
      </div>
      <div className="mb-6 max-w-4xl mx-auto">
        <button
          className={`px-4 py-2 rounded ${isListening ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
          onClick={isListening ? stopListening : startListening}
          disabled={!showCall || !joined}
        >
          {isListening ? 'Stop Answer' : 'Start Answer'}
        </button>
        {speechError && (
          <div className="mt-2 text-red-600 text-sm">{speechError}</div>
        )}
        {(transcript || answerDraft) && (
          <div className="mt-4 p-2 border rounded bg-gray-50">
            <div className="font-semibold mb-1">Your Answer:</div>
            <Textarea
              className="w-full mb-2"
              rows={3}
              value={answerDraft}
              onChange={e => setAnswerDraft(e.target.value)}
              placeholder="Edit or write your answer here..."
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded"
              onClick={() => handleAnswerSubmit(answerDraft)}
              disabled={!answerDraft.trim() || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </button>
          </div>
        )}
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Interview Interface */}
        <div className="lg:col-span-2">
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              disabled={interviewData.currentQuestionIndex === 0}
              onClick={() => goToQuestion(interviewData.currentQuestionIndex - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={interviewData.currentQuestionIndex === interviewData.questions.length - 1}
              onClick={() => goToQuestion(interviewData.currentQuestionIndex + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        {/* Interview Progress Sidebar */}
        <div className="space-y-6">
          {/* Candidate Info */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium text-gray-900 mb-4">Candidate Information</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <i className="fas fa-user text-gray-400 w-4"></i>
                  <span className="text-sm text-gray-600">{interviewData.candidateName || 'Candidate'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <i className="fas fa-briefcase text-gray-400 w-4"></i>
                  <span className="text-sm text-gray-600">{interviewData.candidateRole || 'Developer'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <i className="fas fa-phone text-gray-400 w-4"></i>
                  <span className="text-sm text-gray-600">{interviewData.candidatePhone || 'Phone'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questions Progress */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium text-gray-900 mb-4">Questions Progress</h4>
              <div className="space-y-3">
                {interviewData.questions.map((_, index) => {
                  const isCurrent = index === interviewData.currentQuestionIndex;
                  const isAnswered = answeredQuestions.includes(index);
                  const isPending = index > interviewData.currentQuestionIndex;
                  
                  return (
                    <div
                      key={index}
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        isCurrent ? 'bg-primary bg-opacity-10 border border-primary border-opacity-20' : ''
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCurrent ? 'bg-primary' : isAnswered ? 'bg-green-600' : 'bg-gray-200'
                      }`}>
                        <span className={`text-xs font-medium ${
                          isCurrent || isAnswered ? 'text-white' : 'text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          isCurrent ? 'text-gray-900' : 'text-gray-600'
                        }`}>
                          {questionTypes[index] || 'Question'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {isCurrent ? 'Current Question' : isAnswered ? 'Answered' : 'Pending'}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {isAnswered && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Done
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge variant="default" className="bg-orange-100 text-orange-800">
                            Active
                          </Badge>
                        )}
                        {isPending && (
                          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Live Scoring */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium text-gray-900 mb-4">Live Evaluation</h4>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{currentScore || '--'}</div>
                  <div className="text-sm text-gray-600">Latest Score</div>
                </div>
                {latestFeedback && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Latest Feedback</div>
                    <p className="text-sm text-gray-800">{latestFeedback}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

