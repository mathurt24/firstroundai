import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/authContext';

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-10 text-center">
        <h1 className="text-3xl font-bold mb-4 text-primary">Welcome to AI Interview Platform</h1>
        <p className="text-gray-600 mb-8">AI-powered, voice-enabled, and human-like interview experience for candidates and admins.</p>
        <div className="flex flex-col space-y-4">
          {!user && (
            <Button className="w-full" onClick={() => setLocation('/login')}>Login / Signup</Button>
          )}
          {user && (
            <Button className="w-full" variant="outline" onClick={() => setLocation('/interview-upload')}>
              Start Interview
            </Button>
          )}
          {user && (
            <Button className="w-full" variant="ghost" onClick={logout}>
              Logout
            </Button>
          )}
        </div>
        {!user && <p className="text-xs text-gray-500 mt-4">You must be logged in to start an interview.</p>}
      </div>
    </div>
  );
} 