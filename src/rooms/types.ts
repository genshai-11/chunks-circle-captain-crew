import type { MeaningEvaluation, TranscriptResult } from '@/types';

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoundStatus = 'captain_speaking' | 'crew_speaking' | 'evaluating' | 'finished';

export interface RoomDoc {
  hostId: string;
  captainId?: string | null;
  crewId?: string | null;
  captainName?: string | null;
  crewName?: string | null;
  captainScore?: number;
  crewScore?: number;
  joinCode?: string;
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

  // Optional timeout metadata
  crewDeadlineAtMs?: number;
  winnerRole?: 'captain' | 'crew' | 'none';
  endReason?: 'meaning' | 'crew_timeout' | 'manual';

  captainTranscript?: string;
  crewTranscript?: string;
  captainTranscriptMeta?: TranscriptResult;
  crewTranscriptMeta?: TranscriptResult;

  captainAudioPath?: string;
  crewAudioPath?: string;
  captainAudioMimeType?: string;
  crewAudioMimeType?: string;

  meaningScore?: number;
  feedback?: string;
  meaningAnalysis?: MeaningEvaluation;
  reactionDelayMs?: number;
}
