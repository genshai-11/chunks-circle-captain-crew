import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

function getAudioExtension(mimeType: string) {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

export async function uploadRoundAudio(roundId: string, role: 'captain' | 'crew', audioBlob: Blob) {
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }

  const mimeType = audioBlob.type || 'audio/webm';
  const extension = getAudioExtension(mimeType);
  const path = `rounds/${roundId}/${role}.${extension}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, audioBlob, {
    contentType: mimeType,
    cacheControl: 'public,max-age=3600',
  });

  const url = await getDownloadURL(storageRef);
  return {
    path,
    url,
    mimeType,
  };
}
