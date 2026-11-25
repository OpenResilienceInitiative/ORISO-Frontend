import { describe, expect, it } from 'vite-plus/test';
import {
	createPracticeMurmur,
	levelFromSamples,
	murmurLine,
	syllablesInWord
} from './practiceCallMurmur';
import { FakeAudioContext } from './practiceCallMedia.testkit';

describe("Carimat's fallback murmur (FE#2545 D3)", () => {
	it('counts syllables from vowel groups, and by letters where no vowels are written', () => {
		expect(syllablesInWord('Hallo,')).toBe(2);
		expect(syllablesInWord('Gesprächskreis')).toBe(3);
		expect(syllablesInWord('Здравствуйте')).toBe(3);
		expect(syllablesInWord('ሰላም')).toBe(1);
		expect(syllablesInWord('—')).toBe(0);
	});

	it('turns a line into syllables in order, with longer pauses after a sentence', () => {
		const line = murmurLine('Hallo, ich bin Mia. Schön!');
		expect(line.syllables).toHaveLength(6);
		line.syllables.forEach((s, i) => {
			expect(s.end).toBeGreaterThan(s.start);
			if (i > 0) {
				expect(s.start).toBeGreaterThanOrEqual(
					line.syllables[i - 1].end
				);
			}
		});
		const gap = (i: number) =>
			line.syllables[i + 1].start - line.syllables[i].end;
		// Hal-lo, ich, bin, Mia., Schön!: "Hallo," ends at 1, "Mia." at 4.
		expect(gap(4)).toBeGreaterThan(gap(1));
		expect(gap(1)).toBeGreaterThan(gap(2));
		expect(line.duration).toBe(line.syllables[5].end);
	});

	it('sounds the same every time and falls in pitch towards the end', () => {
		const text =
			'Hallo, ich bin Mia. Schön, dass Sie den Kreis eröffnet haben.';
		expect(murmurLine(text)).toEqual(murmurLine(text));
		const { syllables } = murmurLine(text);
		const unstressedAverage = (part: typeof syllables) =>
			part.reduce((sum, s) => sum + s.pitch, 0) / part.length;
		expect(unstressedAverage(syllables.slice(0, 5))).toBeGreaterThan(
			unstressedAverage(syllables.slice(-5))
		);
	});

	it('reads a level between 0 and 1 from the samples', () => {
		expect(levelFromSamples([])).toBe(0);
		expect(levelFromSamples(new Float32Array(64))).toBe(0);
		expect(levelFromSamples(new Float32Array(64).fill(0.1))).toBeCloseTo(
			0.6,
			5
		);
		expect(levelFromSamples(new Float32Array(64).fill(1))).toBe(1);
	});

	it('starts its sources, reports a level while speaking, and stops every source', () => {
		const context = new FakeAudioContext();
		const murmur = createPracticeMurmur(context as unknown as AudioContext);
		expect(context.sources).toHaveLength(2);
		context.sources.forEach((s) =>
			expect((s as any).start).toHaveBeenCalled()
		);

		const seconds = murmur.speak('Hallo Mia');
		expect(seconds).toBeGreaterThan(0.3);
		expect(murmur.level()).toBeGreaterThan(0);

		murmur.stop();
		context.sources.forEach((s) => expect(s.stop).toHaveBeenCalled());
		expect(murmur.level()).toBe(0);
		expect(murmur.speak('Hallo')).toBe(0);
	});
});
