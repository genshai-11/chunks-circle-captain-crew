import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../hooks/useRoom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { evaluateMeaningTransfer } from '../services/geminiService';
import { transcribeAudioDeepgram } from '../services/deepgramService';
import { motion } from 'motion/react';
import { Mic, Square, ArrowLeft, Link as LinkIcon, Check } from 'lucide-react';

interface RoomProps {
  roomId: string;
  onLeave: () => void;
}

export const Room: React.FC<RoomProps> = ({ roomId, onLeave }) => {
  const { user } = useAuth();
  const { room, rounds, loading } = useRoom(roomId);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!room) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">Room not found. <button onClick={onLeave} className="mt-4 text-zinc-100 underline">Go back</button></div>;

  const isCaptain = room.captainId === user?.uid;
  const isCrew = room.crewId === user?.uid;
  const canJoinAsCaptain = !room.captainId && !isCrew;
  const canJoinAsCrew = !room.crewId && !isCaptain;

  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;

  const joinRole = async (role: 'captain' | 'crew') => {
    if (!user) return;
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        [role === 'captain' ? 'captainId' : 'crewId']: user.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
    }
  };

  const startRound = async () => {
    if (!user || !isCaptain) return;
    try {
      const roundsRef = collection(db, 'rooms', roomId, 'rounds');
      await addDoc(roundsRef, {
        roomId,
        roundNumber: rounds.length + 1,
        status: 'captain_speaking',
        createdAt: serverTimestamp(),
      });
      
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        status: 'playing',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}/rounds`);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleRecordingStop;
      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Microphone access is required to play.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
      setProcessing(true);
    }
  };

  const handleRecordingStop = async () => {
    if (!currentRound) return;
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    
    const role = isCaptain ? 'captain' : 'crew';
    const language = isCaptain ? 'vi' : 'en';
    
    const transcript = await transcribeAudioDeepgram(audioBlob, language);
    
    const roundRef = doc(db, 'rooms', roomId, 'rounds', currentRound.id);
      
      try {
        if (isCaptain) {
          await updateDoc(roundRef, {
            captainTranscript: transcript,
            status: 'crew_speaking',
          });
        } else if (isCrew) {
          await updateDoc(roundRef, {
            crewTranscript: transcript,
            status: 'evaluating',
          });
          
          // Fetch the latest round data to ensure we have the captain's transcript
          const latestRoundSnap = await getDoc(roundRef);
          const latestRoundData = latestRoundSnap.data();
          
          // Evaluate immediately
          const result = await evaluateMeaningTransfer(
            latestRoundData?.captainTranscript || '',
            transcript
          );
          
          await updateDoc(roundRef, {
            meaningScore: result.score,
            feedback: result.feedback,
            status: 'finished',
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/rounds/${currentRound.id}`);
      }
      setProcessing(false);
  };

  const renderRoleSelection = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <h2 className="text-2xl font-bold text-zinc-100">Choose your role</h2>
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => joinRole('captain')}
          disabled={!canJoinAsCaptain}
          className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-colors ${
            isCaptain ? 'border-green-500 bg-green-900/50' : 
            canJoinAsCaptain ? 'border-zinc-800 hover:border-green-500/50 bg-zinc-900/50' : 'border-zinc-800 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className={`text-xl font-bold ${isCaptain ? 'text-green-400' : 'text-zinc-100'}`}>Captain</div>
          <div className="text-sm text-zinc-400 text-center">Speaks Vietnamese</div>
        </button>
        <button
          onClick={() => joinRole('crew')}
          disabled={!canJoinAsCrew}
          className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-colors ${
            isCrew ? 'border-red-500 bg-red-900/50' : 
            canJoinAsCrew ? 'border-zinc-800 hover:border-red-500/50 bg-zinc-900/50' : 'border-zinc-800 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className={`text-xl font-bold ${isCrew ? 'text-red-400' : 'text-zinc-100'}`}>Crew</div>
          <div className="text-sm text-zinc-400 text-center">Translates to English</div>
        </button>
      </div>
      {(!room.captainId || !room.crewId) && (
        <p className="text-zinc-500 animate-pulse">Waiting for players...</p>
      )}
    </div>
  );

  const renderGameLoop = () => {
    if (!currentRound || currentRound.status === 'finished') {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-8">
          {currentRound && currentRound.status === 'finished' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-md text-center space-y-6"
            >
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center border-4 border-zinc-700">
                  <span className="text-4xl font-bold text-zinc-100">{currentRound.meaningScore}%</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-zinc-100 mb-2">Meaning Transfer</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{currentRound.feedback}</p>
              </div>
            </motion.div>
          )}
          
          {isCaptain ? (
            <button
              onClick={startRound}
              className="bg-zinc-100 text-zinc-950 font-medium py-4 px-8 rounded-full hover:bg-zinc-200 transition-colors"
            >
              Start New Round
            </button>
          ) : (
            <p className="text-zinc-500">Waiting for Captain to start...</p>
          )}
        </div>
      );
    }

    const isMyTurn = (isCaptain && currentRound.status === 'captain_speaking') || 
                     (isCrew && currentRound.status === 'crew_speaking');

    return (
      <div className="flex flex-col items-center justify-center h-full space-y-12">
        <div className="text-center space-y-2">
          <h2 className={`text-3xl font-bold ${
            currentRound.status === 'captain_speaking' ? 'text-green-400' : 
            currentRound.status === 'crew_speaking' ? 'text-red-400' : 'text-zinc-100'
          }`}>
            {currentRound.status === 'captain_speaking' ? 'Captain is speaking' : 
             currentRound.status === 'crew_speaking' ? 'Crew is translating' : 'Evaluating...'}
          </h2>
          <p className="text-zinc-500">
            {currentRound.status === 'captain_speaking' ? 'Vietnamese' : 
             currentRound.status === 'crew_speaking' ? 'English' : 'Analyzing meaning transfer'}
          </p>
        </div>

        {currentRound.status === 'evaluating' ? (
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-zinc-100 rounded-full animate-spin" />
        ) : isMyTurn ? (
          <div className="flex flex-col items-center gap-6">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={processing}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                recording ? (isCaptain ? 'bg-green-500 scale-110 shadow-[0_0_40px_rgba(34,197,94,0.4)]' : 'bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.4)]') : 
                processing ? 'bg-zinc-800 opacity-50 cursor-not-allowed' : 'bg-zinc-100 hover:bg-zinc-200'
              }`}
            >
              {recording ? (
                <Square className="w-10 h-10 text-white fill-current" />
              ) : (
                <Mic className="w-12 h-12 text-zinc-950" />
              )}
            </button>
            <p className="text-zinc-400 text-sm font-medium uppercase tracking-widest">
              {recording ? 'Release to send' : processing ? 'Processing...' : 'Hold to speak'}
            </p>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center">
            <Mic className="w-10 h-10 text-zinc-700" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="p-6 flex items-center justify-between border-b border-zinc-900">
        <button onClick={onLeave} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="text-sm font-medium text-zinc-500 uppercase tracking-widest">
          Room {roomId.slice(0, 4)}
        </div>
        <button 
          onClick={handleCopyLink} 
          className="p-2 -mr-2 text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-2"
          title="Copy Invite Link"
        >
          {copied ? <Check className="w-5 h-5 text-green-500" /> : <LinkIcon className="w-5 h-5" />}
        </button>
      </header>

      <main className="flex-1 p-6">
        {(!room.captainId || !room.crewId) ? renderRoleSelection() : renderGameLoop()}
      </main>
    </div>
  );
};
