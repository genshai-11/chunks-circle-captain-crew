import type { MeaningEvaluation, TranscriptResult } from '@/types';

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoundStatus = 'captain_speaking' | 'crew_speaking' | 'evaluating' | 'finished';

export interface RoomDoc {
  hostId: string;
  captainId?: string;
  crewId?: string;
  status: RoomStatus;
  createdAt: any;
  updatedAt: any;
}

export interface RoomRoundDoc {
  roomId: string;
  roundNumber: number;
  status: RoundStatus;
  createdAt: any;

  captainStoppedAtMs?: number;
  crewStartedAtMs?: number;

  captainTranscript?: string;
  crewTranscript?: string;
  captainTranscriptMeta?: TranscriptResult;
  crewTranscriptMeta?: TranscriptResult;

  meaningScore?: number;
  feedback?: string;
  meaningAnalysis?: MeaningEvaluation;
  reactionDelayMs?: number;
}
