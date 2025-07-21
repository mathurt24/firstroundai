import fetch from "node-fetch";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Default ElevenLabs voice

export async function textToSpeech(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
} 