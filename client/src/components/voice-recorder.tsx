import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Square, Play, RotateCcw } from 'lucide-react';
import { useSpeechRecognition, useSpeechSynthesis } from '@/hooks/use-speech';

interface VoiceRecorderProps {
  question: string;
  onAnswerSubmit: (answer: string) => void;
  onSkip: () => void;
  isSubmitting: boolean;
  initialAnswer?: string;
}

export function VoiceRecorder({ question, onAnswerSubmit, onSkip, isSubmitting, initialAnswer }: VoiceRecorderProps) {
  const [manualAnswer, setManualAnswer] = useState(initialAnswer || '');
  const [recordingTime, setRecordingTime] = useState(0);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    isSupported: speechRecognitionSupported,
    isListening,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechRecognition();

  const {
    isSupported: speechSynthesisSupported,
    isSpeaking,
    speak,
    stopSpeaking,
  } = useSpeechSynthesis();

  useEffect(() => {
    setManualAnswer(initialAnswer || '');
  }, [initialAnswer, question]);

  useEffect(() => {
    if (isListening) {
      const id = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setIntervalId(id);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isListening]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRecording = () => {
    if (isListening) {
      stopListening();
      setRecordingTime(0);
    } else {
      clearTranscript();
      setManualAnswer('');
      startListening();
      setRecordingTime(0);
    }
  };

  const handlePlayQuestion = async () => {
    const ttsProvider = localStorage.getItem('ttsProvider') || 'python';
    if (ttsProvider === 'elevenlabs') {
      // Fetch audio from backend and play
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: question, provider: 'elevenlabs' })
        });
        if (!res.ok) throw new Error('Failed to fetch audio');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        // Always create a new Audio object for Safari compatibility
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(err => {
          alert('Safari blocked audio playback. Please click again or check your browser settings.');
        });
      } catch (err) {
        alert('Failed to play ElevenLabs audio. Falling back to browser TTS.');
        speak(question);
      }
    } else {
      speak(question);
    }
  };

  const handleSubmit = () => {
    const answer = transcript.trim() || manualAnswer.trim();
    if (answer) {
      onAnswerSubmit(answer);
    }
  };

  const handleClear = () => {
    clearTranscript();
    setManualAnswer('');
    setRecordingTime(0);
    if (isListening) {
      stopListening();
    }
  };

  const currentAnswer = transcript.trim() || manualAnswer.trim();

  return (
    <Card>
      <CardContent className="p-8">
        {/* Question Display */}
        <div className="mb-8">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <i className="fas fa-robot text-white"></i>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-2">Tushar AI Interviewer</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800 leading-relaxed">{question}</p>
              </div>
              {/* Text-to-Speech Controls */}
              <div className="flex items-center space-x-3 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayQuestion}
                  className="text-primary hover:text-blue-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Play Question
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => speak(question)}
                  disabled={isSpeaking}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Repeat
                </Button>
                <audio ref={audioRef} hidden />
              </div>
            </div>
          </div>
        </div>

        {/* Answer Recording Interface */}
        <div className="border-t pt-8">
          <h4 className="font-medium text-gray-900 mb-4">Your Answer</h4>
          
          {/* Voice Recording Controls */}
          <div className="flex flex-col items-center space-y-4 mb-6">
            <Button
              onClick={handleToggleRecording}
              disabled={!speechRecognitionSupported}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
                isListening 
                  ? 'bg-green-600 hover:bg-green-700 animate-pulse' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isListening ? (
                <Square className="h-8 w-8 text-white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </Button>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                {!speechRecognitionSupported
                  ? 'Speech recognition not supported'
                  : isListening 
                    ? 'Recording... Click to stop'
                    : 'Click to start recording'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">{formatTime(recordingTime)}</p>
            </div>
          </div>

          {/* Speech Error Display */}
          {speechError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-600">{speechError}</p>
            </div>
          )}

          {/* Real-time Transcription */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 min-h-[100px]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Live Transcription</label>
              <span className="text-xs text-gray-500">Powered by Web Speech API</span>
            </div>
            <div className="text-gray-800">
              {transcript ? (
                <p>{transcript}</p>
              ) : (
                <p className="italic text-gray-500">Your speech will appear here in real-time...</p>
              )}
            </div>
          </div>

          {/* Manual Text Input Option */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or type your answer manually
            </label>
            <Textarea
              value={manualAnswer}
              onChange={(e) => setManualAnswer(e.target.value)}
              className="w-full"
              rows={4}
              placeholder="Type your answer here..."
              disabled={transcript.length > 0}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={onSkip}
              disabled={isSubmitting}
              className="text-gray-500 hover:text-gray-700"
            >
              <i className="fas fa-skip-forward mr-2"></i>Skip Question
            </Button>
            <div className="space-x-3">
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={isSubmitting || (!transcript && !manualAnswer)}
              >
                Clear
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !currentAnswer}
                className="bg-primary text-white hover:bg-blue-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
