import React, { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack, IRemoteAudioTrack, UID } from 'agora-rtc-sdk-ng';

const AGORA_APP_ID = '5ad0dfbd097945a98cba400b173f9581'; // <-- Replace with your actual Agora App ID
const AGORA_CHANNEL = 'interview'; // You can make this dynamic per interview

export default function AgoraCall({ channel = AGORA_CHANNEL, token = null, uid = null, setJoined, joined, onLeaveCall }: { channel?: string; token?: string | null; uid?: string | null; setJoined?: (joined: boolean) => void; joined?: boolean; onLeaveCall?: () => void }) {
  // joined state is now managed by parent via setJoined
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const localTracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    return () => {
      leaveCall();
    };
    // eslint-disable-next-line
  }, []);

  async function joinCall() {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;
    await client.join(AGORA_APP_ID, channel, '007eJxTYJB8MG1e4INMi7ytP6VD1IIelxxmyzdy+CvsW5g+xy0p54ECg2liikFKWlKKgaW5pYlpoqVFclKiiYFBkqG5cZqlqYUhE1tdRkMgI8P79CvMjAwQCOJzMmTmlaQWlWWmljMwAACn6iB0', uid || null);
    const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
    localTracksRef.current = tracks;
    await client.publish(tracks);
    setJoined && setJoined(true);
    setIsMuted(false);
    if (localVideoRef.current) {
      tracks[1].play(localVideoRef.current);
    }
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers([...client.remoteUsers]);
      if (mediaType === 'video' && remoteVideoRef.current) {
        user.videoTrack?.play(remoteVideoRef.current);
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    });
    client.on('user-unpublished', (user) => {
      setRemoteUsers([...client.remoteUsers]);
    });
    client.on('user-left', (user) => {
      setRemoteUsers([...client.remoteUsers]);
    });
  }

  async function leaveCall() {
    const client = clientRef.current;
    if (client) {
      if (localTracksRef.current) {
        await client.unpublish(localTracksRef.current);
        localTracksRef.current[0].close();
        localTracksRef.current[1].close();
        localTracksRef.current = null;
      }
      await client.leave();
      setRemoteUsers([]);
      setIsMuted(false);
      setJoined && setJoined(false);
      onLeaveCall && onLeaveCall();
    }
  }

  function toggleMute() {
    if (localTracksRef.current) {
      const micTrack = localTracksRef.current[0];
      micTrack.setEnabled(!isMuted); // Fix: toggle to the opposite of isMuted
      setIsMuted((m) => !m);
    }
  }

  return (
    <div className="agora-call-ui p-4 border rounded-lg">
      <div className="flex gap-4 mb-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={joinCall} disabled={!!joined}>
          Join Call
        </button>
        <button className="px-4 py-2 bg-gray-300 rounded" onClick={async () => { await leaveCall(); }} disabled={!joined}>
          Leave Call
        </button>
        <button className={`px-4 py-2 rounded ${isMuted ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'}`} onClick={toggleMute} disabled={!joined}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
      <div className="flex gap-4">
        <div>
          <div ref={localVideoRef} className="w-64 h-48 bg-black rounded mb-2" />
          <div className="text-center text-xs">You</div>
        </div>
        <div className="flex flex-col items-center justify-center w-64 h-48 bg-gray-100 rounded mb-2">
          <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-2">
            <span role="img" aria-label="AI">🤖</span>
          </div>
          <div className="text-center text-xs font-semibold">AI Interviewer</div>
          <div className="text-center text-xs text-gray-500">The AI is listening to your answer</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">Channel: {channel}</div>
      <div className="mt-2 text-xs text-gray-500">App ID: {AGORA_APP_ID.slice(0, 6)}... (set your real App ID)</div>
    </div>
  );
} 