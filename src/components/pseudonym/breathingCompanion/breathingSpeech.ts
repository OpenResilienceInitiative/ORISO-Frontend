import { pickLocalVoice } from '../../../utils/localSpeechVoice';

/**
 * The voice for the spoken breathing cues: a local (on-device) voice of the
 * page language, or null. Never a network voice, so the cue text never
 * leaves the device; with null the companion does not speak at all.
 */
export const breathingVoiceFor = (
	voices: readonly SpeechSynthesisVoice[],
	lang: string
): SpeechSynthesisVoice | null => pickLocalVoice([...voices], lang);
