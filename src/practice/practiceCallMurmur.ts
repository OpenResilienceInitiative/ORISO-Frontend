/*
 * FE#2545 D3: Carimat's fallback voice in the practice call, used when the
 * device has no local speech voice for the page language. Not speech and not an
 * asset: a voiced buzz (sawtooth through two vowel-like band-pass filters)
 * plus a little breath noise, switched on and off by a syllable-shaped
 * envelope. Everything is generated in the page; nothing is fetched.
 */

/** One syllable of the murmur, in seconds from the line's start. */
export interface MurmurSyllable {
	start: number;
	end: number;
	/** Envelope peak, 0..1. */
	peak: number;
	/** Voice pitch in Hz. */
	pitch: number;
	/** First "formant" in Hz: changes the vowel colour per syllable. */
	vowel: number;
}

export interface MurmurLine {
	syllables: MurmurSyllable[];
	/** Seconds from the first syllable's start to the last one's end. */
	duration: number;
}

const VOWEL_GROUPS = /[aeiouyäöüàâáéèêëíîïóôúûùœæаеёиоуыэюяıəɛ]+/giu;
const LETTERS = /\p{L}/gu;

/**
 * Roughly how many syllables a word has: its vowel groups, or for scripts
 * without written vowels (Ge'ez) one per three letters.
 */
export const syllablesInWord = (word: string): number => {
	const vowels = word.match(VOWEL_GROUPS)?.length ?? 0;
	if (vowels > 0) return vowels;
	const letters = word.match(LETTERS)?.length ?? 0;
	return letters === 0 ? 0 : Math.max(1, Math.round(letters / 3));
};

/** A fixed pseudo-random sequence: the same line always sounds the same. */
const wobble = (seed: number): number => {
	const x = Math.sin(seed * 12.9898) * 43758.5453;
	return x - Math.floor(x);
};

const SYLLABLE_SECONDS = 0.16;
const WORD_GAP = 0.05;
const COMMA_PAUSE = 0.22;
const SENTENCE_PAUSE = 0.45;
const BASE_PITCH = 215;
const VOWELS_HZ = [480, 620, 740, 540, 820];

/** The syllable timeline of one caption line. */
export const murmurLine = (text: string): MurmurLine => {
	const words = text.split(/\s+/).filter(Boolean);
	const total = words.reduce((n, word) => n + syllablesInWord(word), 0);
	const syllables: MurmurSyllable[] = [];
	let time = 0;
	let index = 0;
	for (const word of words) {
		const count = syllablesInWord(word);
		for (let i = 0; i < count; i += 1) {
			const progress = total > 1 ? index / (total - 1) : 0;
			const length = SYLLABLE_SECONDS * (0.75 + wobble(index + 1) * 0.6);
			// A falling phrase contour with a stressed first syllable per word.
			const pitch =
				BASE_PITCH +
				25 * (1 - progress) -
				20 * progress +
				(i === 0 ? 18 : 0) +
				wobble(index + 7) * 10;
			syllables.push({
				start: time,
				end: time + length,
				peak: i === 0 ? 0.9 : 0.55 + wobble(index + 3) * 0.3,
				pitch,
				vowel: VOWELS_HZ[
					Math.floor(wobble(index + 11) * VOWELS_HZ.length)
				]
			});
			time += length;
			index += 1;
		}
		time += /[.!?…]$/.test(word)
			? SENTENCE_PAUSE
			: /[,;:]$/.test(word)
				? COMMA_PAUSE
				: WORD_GAP;
	}
	const duration = syllables.length ? syllables[syllables.length - 1].end : 0;
	return { syllables, duration };
};

/** The level the speaking ring shows: RMS of the samples, scaled to 0..1. */
export const levelFromSamples = (samples: ArrayLike<number>): number => {
	if (samples.length === 0) return 0;
	let sum = 0;
	for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
	return Math.min(1, Math.sqrt(sum / samples.length) * 6);
};

export interface PracticeMurmur {
	/** Plays the line now; returns its length in seconds. */
	speak: (text: string) => number;
	/** The current output level, 0..1 (drives the speaking ring). */
	level: () => number;
	/** Cuts the line that is playing (mute). */
	silence: () => void;
	/** Silences and disconnects every node. */
	stop: () => void;
}

const ATTACK = 0.035;
const RELEASE = 0.05;

/** Builds the murmur's audio graph on a running context. */
export const createPracticeMurmur = (context: AudioContext): PracticeMurmur => {
	const master = context.createGain();
	master.gain.value = 0.22;
	const analyser = context.createAnalyser();
	analyser.fftSize = 512;
	master.connect(analyser);
	analyser.connect(context.destination);

	const voice = context.createGain();
	voice.gain.value = 0;
	const lowpass = context.createBiquadFilter();
	lowpass.type = 'lowpass';
	lowpass.frequency.value = 2600;
	voice.connect(lowpass);
	lowpass.connect(master);

	const buzz = context.createOscillator();
	buzz.type = 'sawtooth';
	buzz.frequency.value = BASE_PITCH;
	const formant1 = context.createBiquadFilter();
	formant1.type = 'bandpass';
	formant1.frequency.value = 600;
	formant1.Q.value = 5;
	const formant2 = context.createBiquadFilter();
	formant2.type = 'bandpass';
	formant2.frequency.value = 1250;
	formant2.Q.value = 7;
	buzz.connect(formant1);
	buzz.connect(formant2);
	formant1.connect(voice);
	formant2.connect(voice);

	// One second of white noise, looped: the breath in the voice.
	const noiseBuffer = context.createBuffer(
		1,
		context.sampleRate,
		context.sampleRate
	);
	const channel = noiseBuffer.getChannelData(0);
	for (let i = 0; i < channel.length; i += 1) {
		channel[i] = wobble(i + 1) * 2 - 1;
	}
	const noise = context.createBufferSource();
	noise.buffer = noiseBuffer;
	noise.loop = true;
	const breath = context.createBiquadFilter();
	breath.type = 'bandpass';
	breath.frequency.value = 3200;
	breath.Q.value = 0.8;
	const breathGain = context.createGain();
	breathGain.gain.value = 0.12;
	noise.connect(breath);
	breath.connect(breathGain);
	breathGain.connect(voice);

	buzz.start();
	noise.start();

	const samples = new Float32Array(analyser.fftSize);
	let stopped = false;

	return {
		speak: (text) => {
			if (stopped) return 0;
			const line = murmurLine(text);
			const at = context.currentTime + 0.05;
			const gain = voice.gain;
			gain.cancelScheduledValues(at);
			gain.setValueAtTime(0, at);
			for (const s of line.syllables) {
				const start = at + s.start;
				const end = at + s.end;
				buzz.frequency.setValueAtTime(s.pitch, start);
				formant1.frequency.setValueAtTime(s.vowel, start);
				gain.setValueAtTime(0, start);
				gain.linearRampToValueAtTime(s.peak, start + ATTACK);
				gain.linearRampToValueAtTime(
					s.peak * 0.6,
					Math.max(start + ATTACK, end - RELEASE)
				);
				gain.linearRampToValueAtTime(0, end);
			}
			return line.duration;
		},
		level: () => {
			if (stopped) return 0;
			analyser.getFloatTimeDomainData(samples);
			return levelFromSamples(samples);
		},
		silence: () => {
			if (stopped) return;
			voice.gain.cancelScheduledValues(context.currentTime);
			voice.gain.setValueAtTime(0, context.currentTime);
		},
		stop: () => {
			if (stopped) return;
			stopped = true;
			try {
				buzz.stop();
				noise.stop();
			} catch {
				// Already stopped with its context.
			}
			master.disconnect();
			analyser.disconnect();
		}
	};
};
