import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Eye, Trash, FolderOutput, Fan, Bot } from 'lucide-react';
import { getAdminInterviews, getAdminStats, getAllUsers, startInterview, getAllCandidates, deleteInterview, deleteCandidate } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminDashboard() {
  const { data: interviews = [], isLoading: interviewsLoading } = useQuery({
    queryKey: ['/api/admin/interviews'],
    queryFn: getAdminInterviews,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: getAdminStats,
  });

  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    getAllUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ['/api/candidates/all'],
    queryFn: getAllCandidates,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'Hire': return 'bg-green-100 text-green-800';
      case 'Maybe': return 'bg-yellow-100 text-yellow-800';
      case 'No': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const [ttsProvider, setTtsProvider] = useState(() => localStorage.getItem('ttsProvider') || 'python');
  const [interviewMode, setInterviewMode] = useState(() => localStorage.getItem('interviewMode') || 'web');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', jobRole: '', resume: undefined as File | undefined });
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('ttsProvider', ttsProvider);
  }, [ttsProvider]);
  useEffect(() => {
    localStorage.setItem('interviewMode', interviewMode);
  }, [interviewMode]);

  // Add a handler to start phone interview
  async function handleStartPhoneInterview(candidateId: number, interviewId: number) {
    try {
      const res = await fetch('/api/interviews/start-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ candidateId, interviewId })
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to start phone interview');
      toast({ title: 'Phone Interview Started', description: 'The candidate will receive a call shortly.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to start phone interview', variant: 'destructive' });
    }
  }

  async function handleAddCandidate(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await startInterview({ ...addForm, resume: addForm.resume! });
      toast({ title: 'Candidate/Interview Added', description: 'Interview created successfully.' });
      setShowAdd(false);
      setAddForm({ name: '', email: '', phone: '', jobRole: '', resume: undefined });
      // Refresh interviews without full reload
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/interviews'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add candidate/interview', variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  }

  async function handleStartInterviewForCandidate(candidate: any) {
    try {
      const res = await startInterview({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        jobRole: candidate.jobRole,
        resume: new File([candidate.resumeText], 'resume.txt', { type: 'text/plain' })
      });
      toast({ title: 'Interview Started', description: 'Interview created successfully.' });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/interviews'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to start interview', variant: 'destructive' });
    }
  }

  async function handleDeleteInterview(id: any) {
    const interviewId = Number(id);
    if (isNaN(interviewId)) {
      console.error('Invalid interview ID for deletion:', id);
      toast({ title: 'Error', description: 'Invalid interview ID', variant: 'destructive' });
      return;
    }
    try {
      await deleteInterview(interviewId);
      toast({ title: 'Interview deleted' });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/interviews'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete interview', variant: 'destructive' });
    }
  }

  async function handleDeleteCandidate(id: any) {
    const candidateId = Number(id);
    if (isNaN(candidateId)) {
      console.error('Invalid candidate ID for deletion:', id);
      toast({ title: 'Error', description: 'Invalid candidate ID', variant: 'destructive' });
      return;
    }
    try {
      await deleteCandidate(candidateId);
      toast({ title: 'Candidate deleted' });
      await queryClient.invalidateQueries({ queryKey: ['/api/candidates/all'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/interviews'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete candidate', variant: 'destructive' });
    }
  }

  if (statsLoading || interviewsLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Loading admin dashboard...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Admin Dashboard</h2>
        <p className="text-lg text-gray-600">Manage interviews, candidates, and system settings</p>
      </div>

      {/* User List */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {users.length === 0 && <div className="text-gray-500 text-sm mt-4">No users found.</div>}
          </div>
        </CardContent>
      </Card>

      {/* All Candidates */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>All Candidates</CardTitle>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/candidates/all'] })}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Job Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate: any) => {
                  const hasInterview = interviews.some((i: any) => i.candidate.id === candidate.id);
                  return (
                    <TableRow key={candidate.id}>
                      <TableCell>{candidate.name}</TableCell>
                      <TableCell>{candidate.email}</TableCell>
                      <TableCell>{candidate.phone}</TableCell>
                      <TableCell>{candidate.jobRole}</TableCell>
                      <TableCell>
                        {hasInterview ? (
                          <Button variant="outline" size="sm" disabled>Interview Exists</Button>
                        ) : (
                          <Button variant="default" size="sm" onClick={() => handleStartInterviewForCandidate(candidate)}>
                            Start Interview
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCandidate(candidate.id)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {candidates.length === 0 && <div className="text-gray-500 text-sm mt-4">No candidates found.</div>}
          </div>
        </CardContent>
      </Card>

      {/* Admin Stats */}
      <div className="grid md:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats?.total || 0}</p>
              <p className="text-sm text-gray-600">Total Interviews</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats?.recommended || 0}</p>
              <p className="text-sm text-gray-600">Recommended</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats?.maybe || 0}</p>
              <p className="text-sm text-gray-600">Maybe</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats?.rejected || 0}</p>
              <p className="text-sm text-gray-600">Not Recommended</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats?.avgScore?.toFixed(1) || 0}</p>
              <p className="text-sm text-gray-600">Avg Score</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Interviews */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Interviews</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/interviews'] })}>
                  Refresh
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
                  + Add Candidate/Interview
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showAdd && (
              <form onSubmit={handleAddCandidate} className="mb-8 p-4 bg-gray-50 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Job Role</Label>
                    <Select value={addForm.jobRole} onValueChange={value => setAddForm(f => ({ ...f, jobRole: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="frontend">Frontend Developer</SelectItem>
                        <SelectItem value="backend">Backend Developer</SelectItem>
                        <SelectItem value="fullstack">Full Stack Developer</SelectItem>
                        <SelectItem value="qa">QA Engineer</SelectItem>
                        <SelectItem value="devops">DevOps Engineer</SelectItem>
                        <SelectItem value="ml">ML Engineer</SelectItem>
                        <SelectItem value="mobile">Mobile Developer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Resume</Label>
                    <Input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => setAddForm(f => ({ ...f, resume: e.target.files?.[0] }))} required />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)} disabled={addLoading}>Cancel</Button>
                  <Button type="submit" disabled={addLoading}>{addLoading ? 'Adding...' : 'Add'}</Button>
                </div>
              </form>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews.map((interview: any) => (
                    <TableRow key={interview.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                            <span className="text-primary text-sm font-medium">
                              {getInitials(interview.candidate.name)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{interview.candidate.name}</p>
                            <p className="text-xs text-gray-500">{interview.candidate.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {interview.candidate.jobRole}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(interview.createdAt)}
                      </TableCell>
                      <TableCell>
                        {interview.evaluation ? (
                          <Badge 
                            variant="secondary" 
                            className={`${getScoreColor(interview.evaluation.overallScore)} bg-opacity-10`}
                          >
                            {(interview.evaluation.overallScore / 10).toFixed(1)}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {interview.evaluation ? (
                          <Badge className={getRecommendationColor(interview.evaluation.recommendation)}>
                            {interview.evaluation.recommendation}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In Progress</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteInterview(interview.id)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Admin Controls */}
        <div className="space-y-6">
          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Questions per Interview</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm">
                  <option value="5" selected>5 Questions</option>
                  <option value="7">7 Questions</option>
                  <option value="10">10 Questions</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm">
                  <option value="gpt-4o" selected>GPT-4o</option>
                  <option value="gpt-3.5">GPT-3.5 Turbo</option>
                  <option value="claude">Claude 3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TTS Provider</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={ttsProvider}
                  onChange={e => setTtsProvider(e.target.value)}
                >
                  <option value="python">Python (gTTS)</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Current: <span className="font-semibold">{ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'Python (gTTS)'}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Interview Mode</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={interviewMode}
                  onChange={e => setInterviewMode(e.target.value)}
                >
                  <option value="web">Web</option>
                  <option value="phone">Phone (Twilio)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Current: <span className="font-semibold">{interviewMode === 'phone' ? 'Phone (Twilio)' : 'Web'}</span></p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Voice Recognition</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary peer-focus:ring-opacity-25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="ghost" className="w-full justify-start h-auto p-4">
                <FolderOutput className="h-5 w-5 text-primary mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">Export All Data</p>
                  <p className="text-xs text-gray-500">Download complete interview database</p>
                </div>
              </Button>
              
              <Button variant="ghost" className="w-full justify-start h-auto p-4">
                <Fan className="h-5 w-5 text-orange-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">System Cleanup</p>
                  <p className="text-xs text-gray-500">Remove old interview data</p>
                </div>
              </Button>
              
              <Button variant="ghost" className="w-full justify-start h-auto p-4">
                <Bot className="h-5 w-5 text-green-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">Test AI Models</p>
                  <p className="text-xs text-gray-500">Verify AI system performance</p>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Connected</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">AI Service</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Speech API</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Available</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Storage</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-yellow-600">75% Used</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
