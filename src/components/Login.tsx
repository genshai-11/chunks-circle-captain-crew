import React from 'react';
import { signInWithGoogle, signInAnonymously } from '../lib/firebase';
import { LogIn, User } from 'lucide-react';
import { motion } from 'motion/react';
import { Logo } from './Logo';

export const Login: React.FC = () => {
  const pathname = window.location.pathname;
  const isRoomRoute = pathname.startsWith('/room/');
  const roomId = isRoomRoute ? pathname.split('/')[2] : null;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md w-full flex flex-col items-center"
      >
        <Logo size="lg" className="mb-6" />
        <h1 className="text-4xl font-bold text-zinc-100 mb-2">Captain & Crew</h1>
        <p className="text-zinc-400 mb-8">Meaning transfer through speech.</p>
        
        <div className="w-full space-y-4">
          <button
            onClick={signInWithGoogle}
            className="w-full bg-zinc-100 text-zinc-950 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          
          {roomId && (
            <button
              onClick={signInAnonymously}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
            >
              <User className="w-5 h-5" />
              Join Room as Guest
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
