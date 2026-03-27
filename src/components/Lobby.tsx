import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, logOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogOut, Plus, Users, Settings } from 'lucide-react';
import { Logo } from './Logo';
import { useNavigate } from 'react-router-dom';

interface LobbyProps {
  onJoinRoom: (roomId: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoinRoom }) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'rooms'),
      where('status', 'in', ['waiting', 'playing'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid needing a composite index
      fetchedRooms.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setRooms(fetchedRooms);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const roomRef = await addDoc(collection(db, 'rooms'), {
        hostId: user.uid,
        status: 'waiting',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onJoinRoom(roomRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rooms');
    }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <div>
              <h1 className="text-2xl font-bold">Captain & Crew</h1>
              <p className="text-zinc-500 text-sm">Welcome, {profile?.displayName || user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile?.role === 'admin' && (
              <button 
                onClick={() => navigate('/admin')}
                className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Admin Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={logOut}
              className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="space-y-6">
          <button
            onClick={handleCreateRoom}
            disabled={creating}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {creating ? 'Creating...' : 'Create New Game'}
          </button>

          <div className="space-y-4">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Active Games</h2>
            {rooms.length === 0 ? (
              <p className="text-zinc-600 text-center py-8">No active games right now.</p>
            ) : (
              rooms.map(room => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Users className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-medium">Room {room.id.slice(0, 4)}</p>
                      <p className="text-xs text-zinc-500">
                        {room.status === 'waiting' ? 'Waiting for players' : 'In progress'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onJoinRoom(room.id)}
                    className="px-4 py-2 bg-zinc-100 text-zinc-950 text-sm font-medium rounded-xl hover:bg-zinc-200 transition-colors"
                  >
                    Join
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
