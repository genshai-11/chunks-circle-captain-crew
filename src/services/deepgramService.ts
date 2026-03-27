export const transcribeAudioDeepgram = async (
  audioBlob: Blob,
  language: 'vi' | 'en'
): Promise<string> => {
  const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error("Deepgram API key is missing. Please add VITE_DEEPGRAM_API_KEY to your environment variables.");
    return "";
  }

  try {
    const response = await fetch(`https://api.deepgram.com/v1/listen?model=nova-3&language=${language}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': audioBlob.type,
      },
      body: audioBlob,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Deepgram API error:", errorText);
      return "";
    }

    const data = await response.json();
    return data.results?.channels[0]?.alternatives[0]?.transcript || "";
  } catch (error) {
    console.error("Error transcribing with Deepgram:", error);
    return "";
  }
};
