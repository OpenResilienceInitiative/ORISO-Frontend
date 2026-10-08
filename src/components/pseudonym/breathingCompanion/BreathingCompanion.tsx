import * as React from 'react';

// All user-facing copy, including accessible labels. Translate the entire quote
// template; keep each placeholder once, in whichever order the language needs.
export const BREATHING_COPY = {
	title: 'Deine Atempause',
	introTitle: 'Ein Moment für dich.',
	intro: ['Folge der Bewegung.', 'Atme so, wie es sich angenehm anfühlt.'],
	reducedIntro: ['Atme in deinem Tempo.', 'Die Anleitung begleitet dich.'],
	begin: 'Beginnen',
	close: 'Atempause schließen',
	pause: 'Pause',
	resume: 'Weiteratmen',
	pausedTitle: 'Ein Moment Pause.',
	pausedHint: ['Atme in deinem Rhythmus.', 'Du kannst gleich weitermachen.'],
	automatic: 'Autopilot',
	manual: 'Mein Rhythmus',
	switchManual: 'Zu meinem Rhythmus wechseln',
	switchAutomatic: 'Zum Autopilot wechseln',
	finish: 'Für jetzt genug',
	return: 'Zurück zum Warten',
	finishTitle: 'Nimm mit, was dir guttut.',
	phase: ['Einatmen', 'Atem halten', 'Ausatmen', 'Atempause'],
	next: [
		'Jetzt halten',
		'Jetzt ausatmen',
		'Atem ruhen lassen',
		'Wieder einatmen'
	],
	guidance: [
		['Sanft durch die Nase.', 'Dein Bauch darf sich heben.'],
		['Lass die Schultern locker.', 'Nur so lange es dir guttut.'],
		['Sanft durch den Mund.', 'Dein Bauch darf wieder sinken.'],
		['Ein stiller Moment.', 'Der nächste Atemzug kommt.']
	],
	alternative: [
		['Lass den Atem kommen.', 'Du musst nichts erzwingen.'],
		['Nimm deine Schultern wahr.', 'Lass sie ein wenig sinken.'],
		['Lass den Atem ziehen.', 'Ganz ohne Eile.'],
		['Spüre, wie du gerade sitzt.', 'Du darfst dir Zeit lassen.']
	],
	soundOn: 'Klang an',
	soundOff: 'Klang aus',
	soundOptions: 'Klang und Ansage',
	wind: 'Atemwind · Weicher Hall',
	voice: 'Atemphasen ansagen',
	voiceHint: 'Mit der Stimme deines Geräts',
	voiceMissing: 'Auf diesem Gerät ist keine Ansage verfügbar.',
	voiceCue: ['Einatmen', 'Halten', 'Ausatmen', 'Pause'],
	audioError:
		'Klang ist gerade nicht verfügbar. Du kannst ohne Klang weiteratmen.',
	voiceError:
		'Die Ansage ist nicht verfügbar. Der Atemwind begleitet dich weiter.',
	words: { serenity: 'Gelassenheit', courage: 'Mut', wisdom: 'Weisheit' },
	quote: 'Gott, gib mir die {serenity}, Dinge hinzunehmen, die ich nicht ändern kann, den {courage}, Dinge zu ändern, die ich ändern kann, und die {wisdom}, das eine vom anderen zu unterscheiden.'
} as const;

/**
 * SINGLE-FILE HANDOFF — approved breathing companion, not the comparison studio.
 *
 * Usage: <BreathingCompanion onClose={closeWaitingCompanion} />
 * React 18+; React is the only dependency. No imports of CSS, fonts, icons or audio.
 * Start is explicit. Sound starts OFF and is enabled by a user gesture.
 * Native browser APIs: request/cancelAnimationFrame, ResizeObserver, matchMedia,
 * document visibility, Web Audio; optional SpeechSynthesis. No network/storage.
 * These are intentionally allowed: banning all browser APIs would remove sound,
 * container measurement, lifecycle cleanup and the optional spoken guidance.
 * Browser objects are only accessed in effects, events or lazily created helpers.
 *
 * HOST CONTRACT FOR CLAUDE / THE INTEGRATING DEVELOPER:
 * - Give the parent an actual resolved height (or flex: 1 and min-height: 0).
 *   This component fills it with width/height: 100%; supported minimum 300×300.
 * - Background is TRANSPARENT; provide the surrounding surface in the host.
 *   Font is inherited (load Inter once in the application, not in this file).
 * - Map these inherited CSS properties to the actual design-system tokens:
 *     --breathing-accent: primary brand color (fallback #a5000a)
 *     --breathing-text: main text color (fallback #191c20)
 *     --breathing-muted: secondary text color (fallback #43474e)
 *   No surface color is imposed. All glow/tints derive from the accent.
 * - Keep the FOUR phases, not only inhale/hold/exhale: 5/5/5/5 seconds.
 *   Manual mode has no success/failure gate: a tap changes phase at any time.
 *   Future line remains flat after the current manual movement until a tap.
 * - Keep Lichtstrom, original inline phase icons, the exact Weicher Hall renderer
 *   with separate bright/dark pauses, and the three words gathering into text.
 *   Ten full cycles lead into the ending; the finish action can start it sooner.
 * - reducedMotion=true removes the drawing/moving words/fades, not the guidance,
 *   controls or optional sound. When omitted, follow the OS media preference.
 * - All translations live above. Preserve the three quote placeholders once each;
 *   their target positions are measured from real text, not from letter outlines.
 *   Long translations / zoom may scroll in the middle; controls remain reachable.
 * - Host owns dialog/focus trap/Escape/return-focus and chat availability.
 *   When counselling starts, UNMOUNT the component. Unmount/close releases audio,
 *   speech, animation and observers; no chat or routing logic is embedded here.
 * - Validate host themes, longest supported languages, physical iOS audio policy,
 *   modal focus and the real incoming-chat handover after integration.
 *
 * This export combines the last accepted line/audio/ending with the agreed full
 * interaction (start, automatic/manual, pause, finish, continue, close). It omits
 * comparison controls, debug timing labels, scores and alternate sound families.
 */
export type BreathingCopy = typeof BREATHING_COPY;

export interface BreathingCompanionProps {
	onClose: () => void;
	reducedMotion?: boolean;
	/**
	 * Translated copy. Defaults to the German constants above; the host wraps
	 * the component and hands in the i18n resolution (`BreathingCompanionHost`).
	 */
	copy?: BreathingCopy;
}

const PHASE_SECONDS = 5;
const CYCLES = 10;
const END_SECONDS = 27.5;
type Phase = 0 | 1 | 2 | 3;
type Word = keyof typeof BREATHING_COPY.words;
const WORDS: Word[] = ['serenity', 'courage', 'wisdom'];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => (1 - Math.cos(Math.PI * clamp(value))) / 2;
const modulo = (value: number, divisor: number) =>
	((value % divisor) + divisor) % divisor;
type Segment = {
	start: number;
	end: number;
	from: number;
	to: number;
	phase: Phase;
};
type Journey = {
	stage: 'intro' | 'breathing' | 'ending' | 'complete' | 'closed';
	manual: boolean;
	paused: boolean;
	time: number;
	phase: Phase;
	cycles: number;
	segment: Segment;
	history: Segment[];
	endingStart: number;
	endingTime: number;
};
function initialJourney(): Journey {
	return {
		stage: 'intro',
		manual: false,
		paused: false,
		time: 0,
		phase: 0,
		cycles: 0,
		segment: { start: 0, end: Infinity, from: 0, to: 1, phase: 0 },
		history: [],
		endingStart: 0,
		endingTime: 0
	};
}
function segmentLevel(segment: Segment, time: number) {
	return (
		segment.from +
		(segment.to - segment.from) *
			ease((time - segment.start) / PHASE_SECONDS)
	);
}
function journeyLevel(journey: Journey, time: number) {
	if (time < 0) return 0;
	if (time < journey.segment.start) {
		const segment = journey.history.find(
			(s) => time >= s.start && time < s.end
		);
		return segment ? segmentLevel(segment, time) : 0;
	}
	if (journey.manual || time <= journey.segment.start + PHASE_SECONDS)
		return segmentLevel(journey.segment, time);
	let future = journey.segment;
	while (time > future.start + PHASE_SECONDS) {
		const phase = ((future.phase + 1) % 4) as Phase,
			from = future.to;
		future = {
			start: future.start + PHASE_SECONDS,
			end: Infinity,
			from,
			to: phase === 0 ? 1 : phase === 2 ? 0 : from,
			phase
		};
	}
	return segmentLevel(future, time);
}
function advancePhase(journey: Journey, at: number) {
	const from = segmentLevel(journey.segment, at);
	journey.history.push({ ...journey.segment, end: at });
	journey.history = journey.history.filter((s) => s.end >= at - 35);
	if (journey.phase === 3) journey.cycles++;
	journey.phase = ((journey.phase + 1) % 4) as Phase;
	journey.segment = {
		start: at,
		end: Infinity,
		from,
		to: journey.phase === 0 ? 1 : journey.phase === 2 ? 0 : from,
		phase: journey.phase
	};
}

function ControlIcon({
	kind
}: {
	kind: 'close' | 'pause' | 'play' | 'sound' | 'mute' | 'sliders' | 'arrow';
}) {
	const paths = {
		close: <path d="m6 6 12 12M18 6 6 18" />,
		pause: (
			<>
				<rect x="6" y="4" width="4" height="16" rx="1.5" />
				<rect x="14" y="4" width="4" height="16" rx="1.5" />
			</>
		),
		play: <path d="m8 4 12 8-12 8Z" />,
		sound: (
			<>
				<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
			</>
		),
		mute: (
			<>
				<path d="m11 4-6 5H2v6h3l6 5ZM16 9l5 6M21 9l-5 6" />
			</>
		),
		sliders: (
			<>
				<path d="M4 7h16M4 17h16" />
				<circle cx="9" cy="7" r="2" />
				<circle cx="15" cy="17" r="2" />
			</>
		),
		arrow: <path d="M4 12h16m-6-6 6 6-6 6" />
	};
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{paths[kind]}
		</svg>
	);
}

type SceneProps = {
	copy: BreathingCopy;
	journey: Journey;
	reduced: boolean;
	sceneRef: React.RefObject<HTMLDivElement | null>;
	onAction: () => void;
	actionLabel: string;
};
function BreathingScene({
	copy,
	journey,
	reduced,
	sceneRef,
	onAction,
	actionLabel
}: SceneProps) {
	const id = React.useId().replace(/:/g, ''),
		svgRef = React.useRef<SVGSVGElement>(null);
	const quoteGroupRef = React.useRef<HTMLDivElement>(null);
	const [scrollQuote, setScrollQuote] = React.useState(false);
	const [size, setSize] = React.useState({ width: 300, height: 160 });
	const targets = React.useRef<Partial<Record<Word, HTMLSpanElement | null>>>(
		{}
	);
	const [wordTargets, setWordTargets] = React.useState<
		Partial<Record<Word, { x: number; y: number }>>
	>({});
	const ending = journey.stage === 'ending' || journey.stage === 'complete';
	React.useEffect(() => {
		const node = sceneRef.current;
		if (!node) return;
		const measure = () => {
			const box = node.getBoundingClientRect();
			setSize((previous) =>
				previous.width === box.width && previous.height === box.height
					? previous
					: { width: box.width, height: box.height }
			);
			setScrollQuote(
				(quoteGroupRef.current?.offsetHeight || 0) > box.height
			);
			const positions: Partial<Record<Word, { x: number; y: number }>> =
				{};
			WORDS.forEach((word) => {
				const rect = targets.current[word]?.getBoundingClientRect();
				if (rect)
					positions[word] = {
						x: rect.x + rect.width / 2 - box.x,
						y: rect.y + rect.height / 2 - box.y
					};
			});
			setWordTargets(positions);
		};
		measure();
		const observer =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(measure);
		observer?.observe(node);
		if (quoteGroupRef.current) observer?.observe(quoteGroupRef.current);
		WORDS.forEach((word) => {
			const target = targets.current[word];
			if (target) observer?.observe(target);
		});
		return () => observer?.disconnect();
	}, [sceneRef, ending, scrollQuote]);
	const { width: w, height: h } = size;
	const end =
		journey.stage === 'complete' || (reduced && ending)
			? END_SECONDS
			: journey.endingTime;
	const merge = ending ? ease((end - 21) / 4) : 0;
	const quiet = ending ? ease((end - 21) / 4) : 0;
	const room = ending ? ease(end / 2) : 0;
	// Reserve the lower part for guidance; use the whole same-height scene for text.
	const drawingHeight = Math.max(60, h - Math.min(100, h * 0.4));
	const high = drawingHeight * (0.19 + 0.08 * room),
		low = drawingHeight * (0.78 - 0.2 * room);
	const mid = (high + low) / 2;
	const t =
		ending && end > 21
			? journey.endingStart + 21 + 3.5 * (1 - Math.exp(-(end - 21) / 3.5))
			: journey.time;
	const yAt = (time: number) =>
		mid +
		(low - (low - high) * journeyLevel(journey, time) - mid) * (1 - quiet);
	const markerX = w * 0.32,
		markerY = yAt(t),
		scale = w / 24;
	const points: [number, number][] = [];
	for (let x = -4; x <= w + 4; x += 3)
		points.push([x, yAt(t + (x - markerX) / scale)]);
	const path = (items: [number, number][]) =>
		items
			.map(
				([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`
			)
			.join('');
	const line = path(points);
	const ribbon = (thickness: number) => {
		const upper: [number, number][] = [],
			lower: [number, number][] = [];
		points.forEach(([x, y], i) => {
			const a = points[Math.max(0, i - 1)],
				b = points[Math.min(points.length - 1, i + 1)];
			const dx = b[0] - a[0],
				dy = b[1] - a[1],
				length = Math.hypot(dx, dy) || 1;
			upper.push([
				x - (dy / length) * thickness,
				y + (dx / length) * thickness
			]);
			lower.push([
				x + (dy / length) * thickness,
				y - (dx / length) * thickness
			]);
		});
		return path(upper) + path(lower.reverse()).replace(/^M/, 'L') + 'Z';
	};
	const parts = copy.quote.split(/(\{serenity\}|\{courage\}|\{wisdom\})/g);
	return (
		<div className="bc-scene" ref={sceneRef} data-ending={ending}>
			{!reduced && (
				<svg
					className="bc-line"
					ref={svgRef}
					viewBox={`0 0 ${w} ${h}`}
					aria-hidden="true"
					style={{ opacity: ending ? 1 - ease((end - 22) / 4) : 1 }}
				>
					<defs>
						<clipPath id={`${id}-past`}>
							<rect width={markerX} height={h} />
						</clipPath>
						<linearGradient
							id={`${id}-fade`}
							gradientUnits="userSpaceOnUse"
							x1="0"
							x2={markerX}
							y1="0"
							y2="0"
						>
							{[
								[0, 0.01],
								[0.4, 0.3],
								[0.82, 0.88],
								[1, 1]
							].map(([offset, opacity]) => (
								<stop
									key={offset}
									offset={offset}
									stopColor="currentColor"
									stopOpacity={opacity}
								/>
							))}
						</linearGradient>
						<linearGradient
							id={`${id}-edge`}
							gradientUnits="userSpaceOnUse"
							x1="0"
							x2={markerX}
							y1="0"
							y2="0"
						>
							{[
								[0, 1],
								[0.75, 1],
								[1, 0]
							].map(([offset, opacity]) => (
								<stop
									key={offset}
									offset={offset}
									stopColor="currentColor"
									stopOpacity={opacity}
								/>
							))}
						</linearGradient>
						<mask
							id={`${id}-mask`}
							maskUnits="userSpaceOnUse"
							x="0"
							y="0"
							width={w}
							height={h}
							style={{ maskType: 'alpha' }}
						>
							<rect
								width={w}
								height={h}
								fill={`url(#${id}-edge)`}
							/>
						</mask>
						<filter
							id={`${id}-halo`}
							x="-40%"
							y="-100%"
							width="180%"
							height="300%"
						>
							<feGaussianBlur stdDeviation="10" />
						</filter>
						<filter
							id={`${id}-soft`}
							x="-40%"
							y="-100%"
							width="180%"
							height="300%"
						>
							<feGaussianBlur stdDeviation="4" />
						</filter>
						{/* Cut out the marker area instead of imposing an opaque surface color. */}
						<mask
							id={`${id}-orb-cut`}
							style={{ maskType: 'luminance' }}
						>
							<rect width={w} height={h} fill="white" />
							<circle
								cx={markerX}
								cy={markerY}
								r={
									23 *
									(ending ? 1 - ease((end - 19.5) / 2.5) : 1)
								}
								fill="black"
							/>
						</mask>
					</defs>
					<g mask={`url(#${id}-orb-cut)`}>
						<path
							d={line}
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeOpacity=".4"
						/>
						<g clipPath={`url(#${id}-past)`}>
							<g mask={`url(#${id}-mask)`}>
								<path
									d={line}
									fill="none"
									stroke={`url(#${id}-fade)`}
									strokeWidth="25"
									opacity=".28"
									filter={`url(#${id}-halo)`}
								/>
								<path
									d={ribbon(10)}
									fill={`url(#${id}-fade)`}
									opacity=".15"
								/>
								<path
									d={line}
									fill="none"
									stroke={`url(#${id}-fade)`}
									strokeWidth="10"
									opacity=".35"
									filter={`url(#${id}-soft)`}
								/>
								{Array.from({ length: 6 }, (_, i) => (
									<path
										key={i}
										d={path(
											points.map(([x, y]) => [
												x,
												y +
													(i - 2.5) * 3 +
													Math.sin(
														x /
															Math.max(
																30,
																w * 0.18
															) -
															t * 0.12 +
															i * 0.7
													) *
														2 *
														clamp(
															(markerX - x) /
																Math.max(
																	1,
																	markerX
																)
														)
											])
										)}
										fill="none"
										stroke={`url(#${id}-fade)`}
										strokeWidth="1"
										opacity=".19"
									/>
								))}
							</g>
							<path
								d={line}
								fill="none"
								stroke="currentColor"
								strokeWidth="1.7"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</g>
					</g>
				</svg>
			)}
			{!reduced && (
				<button
					className="bc-orb"
					type="button"
					onClick={onAction}
					disabled={ending}
					aria-hidden={ending || undefined}
					aria-label={actionLabel}
					data-hold={journey.phase === 1 || journey.phase === 3}
					style={{
						left: markerX,
						top: markerY,
						opacity: ending ? 1 - ease((end - 19.5) / 2.5) : 1
					}}
				>
					<PhaseIcon phase={journey.phase} />
				</button>
			)}
			<div
				className="bc-quote-group"
				ref={quoteGroupRef}
				data-scroll={scrollQuote}
				style={{
					visibility: ending ? 'visible' : 'hidden',
					pointerEvents: ending ? 'auto' : 'none'
				}}
			>
				<p className="bc-quote" aria-hidden={!ending || end < 25}>
					{parts.map((part, index) => {
						const key = part.slice(1, -1) as Word;
						return WORDS.includes(key) ? (
							<strong
								key={index}
								ref={(node) => {
									targets.current[key] = node;
								}}
								style={{ opacity: merge === 1 ? 1 : 0 }}
							>
								{copy.words[key]}
							</strong>
						) : (
							<span
								key={index}
								style={{
									opacity: ending ? ease((end - 25) / 2.5) : 0
								}}
							>
								{part}
							</span>
						);
					})}
				</p>
				<h2
					className="bc-finish-title"
					aria-hidden={!ending || end < 21}
					style={{ opacity: ending ? ease((end - 21) / 1.5) : 0 }}
				>
					{copy.finishTitle}
				</h2>
			</div>
			{ending &&
				!reduced &&
				WORDS.map((word, i) => {
					const arrival = 6 + i * 6,
						park = ease((end - arrival) / 2),
						parkY =
							Math.max(drawingHeight * 0.64, h * 0.54) +
							i * Math.min(30, h * 0.1);
					const arrivalY = yAt(journey.endingStart + arrival) - 25;
					let x =
						end < arrival
							? markerX + (arrival - end) * scale
							: markerX + (w * 0.5 - markerX) * park;
					let y =
						end < arrival
							? arrivalY
							: arrivalY * (1 - park) + parkY * park;
					if (i > 0 && end >= arrival && park < 1) {
						// Pass beside words already parked instead of crossing through their text.
						const p = park,
							lane = Math.min(28, w * 0.08),
							back = 1 - p;
						x =
							back ** 3 * markerX +
							3 * back ** 2 * p * lane +
							3 * back * p ** 2 * lane +
							p ** 3 * w * 0.5;
						y =
							(back ** 3 + 3 * back ** 2 * p) * arrivalY +
							(3 * back * p ** 2 + p ** 3) * parkY;
					}
					const target = wordTargets[word] || { x: w / 2, y: h / 2 };
					x = x * (1 - merge) + target.x * merge;
					y = y * (1 - merge) + target.y * merge;
					return (
						<span
							key={word}
							className="bc-arrival"
							aria-hidden="true"
							data-word={word}
							data-step={
								end < arrival
									? 'travelling'
									: end < arrival + 2
										? 'parking'
										: merge < 1
											? 'parked'
											: 'text'
							}
							style={{
								left: x,
								top: y,
								opacity:
									merge === 1
										? 0
										: ease(end - (arrival - 4.5))
							}}
						>
							{copy.words[word]}
						</span>
					);
				})}
		</div>
	);
}

export default function BreathingCompanion({
	onClose,
	reducedMotion,
	copy = BREATHING_COPY
}: BreathingCompanionProps) {
	const rootRef = React.useRef<HTMLElement>(null),
		sceneRef = React.useRef<HTMLDivElement>(null);
	const journey = React.useRef<Journey>(initialJourney());
	const manualPreference = React.useRef(false);
	const [, redraw] = React.useReducer((n) => n + 1, 0);
	const [systemReduced, setSystemReduced] = React.useState(false);
	const reduced = reducedMotion ?? systemReduced;
	const reducedRef = React.useRef(reduced);
	reducedRef.current = reduced;
	const [sound, setSound] = React.useState(false),
		soundRef = React.useRef(false);
	const [voice, setVoice] = React.useState(false),
		voiceRef = React.useRef(false);
	const [options, setOptions] = React.useState(false),
		[audioError, setAudioError] = React.useState('');
	const [voiceAvailable, setVoiceAvailable] = React.useState(false);
	const [compact, setCompact] = React.useState(true);
	const audioRef = React.useRef<WindPlayer | null>(null),
		mounted = React.useRef(false);
	const spokenRef = React.useRef<SpeechSynthesisUtterance | null>(null),
		spokenKey = React.useRef('');
	const optionsId = React.useId();
	/* The engine effect runs once, so `speak` inside it would keep the copy of
	   the first render: switching the language mid-session changed every
	   visible word and none of the spoken ones. */
	const copyRef = React.useRef(copy);
	copyRef.current = copy;
	const j = journey.current,
		active = j.stage === 'breathing' || j.stage === 'ending';

	function clearSpeech() {
		if (spokenRef.current && typeof speechSynthesis !== 'undefined')
			speechSynthesis.cancel();
		spokenRef.current = null;
		audioRef.current?.duck(false);
	}
	function speak(phase: Phase, key: string) {
		if (
			!voiceRef.current ||
			!soundRef.current ||
			key === spokenKey.current ||
			typeof speechSynthesis === 'undefined'
		)
			return;
		clearSpeech();
		spokenKey.current = key;
		const utterance = new SpeechSynthesisUtterance(
			copyRef.current.voiceCue[phase]
		);
		utterance.lang =
			rootRef.current?.closest('[lang]')?.getAttribute('lang') || 'de-DE';
		utterance.rate = 0.92;
		utterance.pitch = 0.9;
		utterance.volume = 0.8;
		const voices = speechSynthesis
			.getVoices()
			.filter((v) =>
				v.lang
					.toLowerCase()
					.startsWith(utterance.lang.slice(0, 2).toLowerCase())
			);
		utterance.voice =
			voices.find((v) => v.localService) || voices[0] || null;
		spokenRef.current = utterance;
		audioRef.current?.duck(true);
		utterance.onend = () => {
			if (spokenRef.current === utterance) {
				spokenRef.current = null;
				audioRef.current?.duck(false);
			}
		};
		utterance.onerror = (event) => {
			if (
				!mounted.current ||
				spokenRef.current !== utterance ||
				event.error === 'canceled' ||
				event.error === 'interrupted'
			)
				return;
			spokenRef.current = null;
			audioRef.current?.duck(false);
			voiceRef.current = false;
			setVoice(false);
			setAudioError(copyRef.current.voiceError);
		};
		speechSynthesis.speak(utterance);
	}
	function stop() {
		audioRef.current?.stop();
		clearSpeech();
	}
	function syncSound() {
		const state = journey.current;
		if (
			!soundRef.current ||
			state.paused ||
			!['breathing', 'ending'].includes(state.stage)
		)
			return;
		if (state.stage === 'ending' && state.endingTime >= 19.5) {
			audioRef.current?.stop(1.5);
			clearSpeech();
			return;
		}
		const offset = state.time - state.segment.start;
		audioRef.current?.sync(
			state.phase * 5 + Math.min(offset, 5),
			state.manual && offset >= 5
				? state.phase === 0 || state.phase === 1
					? 'upper'
					: 'lower'
				: null
		);
		if (voiceRef.current) {
			if (state.manual)
				speak(
					state.phase,
					`manual-${state.segment.start}-${state.phase}`
				);
			else if (offset >= 3.8)
				speak(
					((state.phase + 1) % 4) as Phase,
					`auto-${state.segment.start}`
				);
		}
	}
	async function prepareSound() {
		if (!audioRef.current) audioRef.current = new WindPlayer();
		try {
			await audioRef.current.prepare();
			if (mounted.current && soundRef.current) {
				setAudioError('');
				syncSound();
			}
		} catch {
			if (mounted.current) {
				soundRef.current = false;
				voiceRef.current = false;
				setSound(false);
				setVoice(false);
				setAudioError(copyRef.current.audioError);
				stop();
			}
		}
	}
	function begin() {
		stop();
		journey.current = {
			...initialJourney(),
			manual: manualPreference.current,
			stage: 'breathing'
		};
		spokenKey.current = '';
		redraw();
		if (soundRef.current) void prepareSound();
		if (voiceRef.current) speak(0, 'begin');
	}
	function finish() {
		const state = journey.current;
		if (state.stage !== 'breathing') return;
		state.stage = reducedRef.current ? 'complete' : 'ending';
		state.paused = false;
		// The ending runs automatically, beginning from the current continuous curve.
		state.manual = false;
		state.endingStart = state.time;
		state.endingTime = 0;
		if (reducedRef.current) stop();
		redraw();
	}
	function togglePause() {
		const state = journey.current;
		state.paused = !state.paused;
		if (state.paused) stop();
		else if (soundRef.current) void prepareSound();
		redraw();
	}
	function nextPhase() {
		const state = journey.current;
		if (state.paused) {
			togglePause();
			return;
		}
		if (state.stage !== 'breathing' || !state.manual) return;
		advancePhase(state, state.time);
		if (state.cycles >= CYCLES) finish();
		else {
			audioRef.current?.resync();
			clearSpeech();
			syncSound();
		}
		redraw();
	}
	function changeMode() {
		const state = journey.current;
		state.manual = !state.manual;
		manualPreference.current = state.manual;
		// Resume automatic timing from the current shape, not from a reset frame.
		if (!state.manual && state.time - state.segment.start >= 5)
			advancePhase(state, state.time);
		if (state.cycles >= CYCLES) finish();
		audioRef.current?.resync();
		clearSpeech();
		redraw();
	}
	function close() {
		journey.current.stage = 'closed';
		stop();
		audioRef.current?.dispose();
		onClose();
		redraw();
	}
	function toggleSound() {
		soundRef.current = !soundRef.current;
		setSound(soundRef.current);
		if (soundRef.current) void prepareSound();
		else {
			voiceRef.current = false;
			setVoice(false);
			stop();
		}
	}

	React.useEffect(() => {
		mounted.current = true;
		setVoiceAvailable(
			typeof speechSynthesis !== 'undefined' &&
				typeof SpeechSynthesisUtterance !== 'undefined'
		);
		const media =
			typeof matchMedia === 'undefined'
				? null
				: matchMedia('(prefers-reduced-motion: reduce)');
		const preference = () => setSystemReduced(media?.matches ?? false);
		preference();
		media?.addEventListener('change', preference);
		const node = rootRef.current;
		const measure = () => {
			if (node) {
				const box = node.getBoundingClientRect();
				setCompact(box.width < 440 || box.height < 460);
			}
		};
		measure();
		const observer =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(measure);
		if (node) observer?.observe(node);
		let last: number | null = null,
			lastPaint = 0,
			raf = 0;
		const tick = (now: number) => {
			const state = journey.current,
				dt = last === null ? 0 : Math.max(0, (now - last) / 1000);
			last = now;
			if (state.stage === 'closed') return;
			if (
				!document.hidden &&
				!state.paused &&
				(state.stage === 'breathing' || state.stage === 'ending')
			) {
				// Treat an unexpected long browser suspension as a pause, never a catch-up.
				if (dt > 1) {
					state.paused = true;
					stop();
					redraw();
				} else {
					state.time += dt;
					if (!state.manual)
						while (
							state.time - state.segment.start >=
							PHASE_SECONDS
						) {
							advancePhase(
								state,
								state.segment.start + PHASE_SECONDS
							);
							redraw();
							if (
								state.stage === 'breathing' &&
								state.cycles >= CYCLES
							)
								finish();
						}
					if (state.stage === 'ending') {
						state.endingTime = state.time - state.endingStart;
						if (
							state.endingTime >= END_SECONDS ||
							reducedRef.current
						) {
							state.stage = 'complete';
							stop();
							redraw();
						}
					}
					syncSound();
					if (now - lastPaint >= (reducedRef.current ? 150 : 30)) {
						lastPaint = now;
						redraw();
					}
				}
			}
			raf = requestAnimationFrame(tick);
		};
		const visibility = () => {
			last = null;
			if (document.hidden) {
				if (['breathing', 'ending'].includes(journey.current.stage))
					journey.current.paused = true;
				stop();
				redraw();
			}
		};
		document.addEventListener('visibilitychange', visibility);
		raf = requestAnimationFrame(tick);
		return () => {
			mounted.current = false;
			cancelAnimationFrame(raf);
			observer?.disconnect();
			media?.removeEventListener('change', preference);
			document.removeEventListener('visibilitychange', visibility);
			stop();
			audioRef.current?.dispose();
			audioRef.current = null;
		};
		// Engine refs are deliberately stable; changing UI state must not restart it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (j.stage === 'closed') return null;
	const finished = j.stage === 'complete';
	const endingCopy = finished || (j.stage === 'ending' && j.endingTime >= 21);
	const title =
		j.stage === 'intro'
			? copy.introTitle
			: endingCopy
				? copy.finishTitle
				: j.paused
					? copy.pausedTitle
					: copy.phase[j.phase];
	const hint =
		j.stage === 'intro'
			? reduced
				? copy.reducedIntro
				: copy.intro
			: endingCopy
				? []
				: j.paused
					? copy.pausedHint
					: (Math.floor(j.cycles / 2) % 2
							? copy.alternative
							: copy.guidance)[j.phase];
	const guidanceOpacity =
		j.stage !== 'ending' || reduced
			? 1
			: j.endingTime < 21
				? 1 -
					ease(
						(j.endingTime - (compact ? 4 : 19.5)) /
							(compact ? 2 : 1.5)
					)
				: ease((j.endingTime - 21) / 1.5);
	return (
		<section
			className="bc-root"
			ref={rootRef}
			aria-label={copy.title}
			data-compact={compact}
			data-reduced={reduced}
			data-stage={j.stage}
			data-phase={j.phase}
			data-paused={j.paused}
			data-manual={j.manual}
			data-time={j.time.toFixed(3)}
		>
			<style>{STYLES}</style>
			<header className="bc-header">
				{j.stage === 'breathing' ? (
					<button
						className="bc-mode"
						type="button"
						onClick={changeMode}
						aria-label={
							j.manual ? copy.switchAutomatic : copy.switchManual
						}
						aria-pressed={j.manual}
					>
						{j.manual ? copy.manual : copy.automatic}
					</button>
				) : (
					<span className="bc-eyebrow">{copy.title}</span>
				)}
				<div className="bc-header-actions">
					<button
						type="button"
						onClick={toggleSound}
						aria-label={sound ? copy.soundOn : copy.soundOff}
						aria-pressed={sound}
					>
						<ControlIcon kind={sound ? 'sound' : 'mute'} />
						<span className="bc-wide-label">
							{sound ? copy.soundOn : copy.soundOff}
						</span>
					</button>
					<button
						type="button"
						onClick={() => setOptions(!options)}
						aria-label={copy.soundOptions}
						aria-expanded={options}
						aria-controls={optionsId}
					>
						<ControlIcon kind="sliders" />
					</button>
					{active && (
						<button
							type="button"
							onClick={togglePause}
							aria-label={j.paused ? copy.resume : copy.pause}
						>
							<ControlIcon kind={j.paused ? 'play' : 'pause'} />
						</button>
					)}
					<button
						type="button"
						onClick={close}
						aria-label={copy.close}
					>
						<ControlIcon kind="close" />
					</button>
				</div>
			</header>
			{options && (
				<div className="bc-options" id={optionsId}>
					<label>
						<input
							type="checkbox"
							checked={sound}
							onChange={toggleSound}
						/>
						{copy.wind}
					</label>
					<label>
						<input
							type="checkbox"
							checked={voice}
							disabled={!voiceAvailable}
							onChange={() => {
								voiceRef.current = !voiceRef.current;
								setVoice(voiceRef.current);
								clearSpeech();
								spokenKey.current = '';
								if (voiceRef.current) {
									soundRef.current = true;
									setSound(true);
									void prepareSound();
									if (active && !j.paused)
										speak(j.phase, `enabled-${j.time}`);
								}
							}}
						/>
						{copy.voice}
					</label>
					<small>
						{voiceAvailable ? copy.voiceHint : copy.voiceMissing}
					</small>
				</div>
			)}
			<div className="bc-body">
				{j.stage !== 'intro' && (
					<BreathingScene
						copy={copy}
						journey={j}
						reduced={reduced}
						sceneRef={sceneRef}
						onAction={j.manual ? nextPhase : togglePause}
						actionLabel={
							j.paused
								? copy.resume
								: j.manual
									? copy.next[j.phase]
									: copy.pause
						}
					/>
				)}
				<div
					className="bc-guidance"
					aria-live="polite"
					aria-atomic="true"
					aria-hidden={endingCopy || undefined}
					style={{ opacity: endingCopy ? 0 : guidanceOpacity }}
				>
					<h2>{title}</h2>
					<p>
						{hint.map((line) => (
							<span key={line}>{line}</span>
						))}
					</p>
				</div>
				{finished && (
					<span className="bc-sr" role="status">
						{copy.quote.replace(
							/\{(serenity|courage|wisdom)\}/g,
							(_, key: Word) => copy.words[key]
						)}
					</span>
				)}
			</div>
			{audioError && (
				<div className="bc-error" role="status">
					{audioError}
				</div>
			)}
			<footer className="bc-footer">
				{j.stage === 'intro' ? (
					<button
						className="bc-primary"
						type="button"
						onClick={begin}
					>
						{copy.begin}
						<ControlIcon kind="arrow" />
					</button>
				) : finished ? (
					<>
						<button
							className="bc-primary"
							type="button"
							onClick={begin}
						>
							{copy.resume}
						</button>
						<button type="button" onClick={close}>
							<ControlIcon kind="close" />
							{copy.return}
						</button>
					</>
				) : (
					<>
						{j.manual && j.stage === 'breathing' && (
							<button
								className="bc-primary"
								type="button"
								onClick={nextPhase}
							>
								{j.paused ? copy.resume : copy.next[j.phase]}
								<ControlIcon kind="arrow" />
							</button>
						)}
						<button
							type="button"
							onClick={j.stage === 'ending' ? close : finish}
						>
							<ControlIcon kind="close" />
							{j.stage === 'ending' ? copy.return : copy.finish}
						</button>
					</>
				)}
			</footer>
		</section>
	);
}

const STYLES = `
.bc-root{--bc-accent:var(--breathing-accent,#a5000a);--bc-text:var(--breathing-text,#191c20);--bc-muted:var(--breathing-muted,#43474e);width:100%;height:100%;min-width:0;min-height:0;box-sizing:border-box;position:relative;isolation:isolate;display:flex;flex-direction:column;background:transparent;color:var(--bc-text);font-family:inherit;padding:clamp(8px,3%,28px);gap:6px;overflow:hidden}
.bc-root *{box-sizing:border-box}.bc-root button{font:inherit;font-size:14px;color:inherit;background:transparent;border:0;cursor:pointer;min-height:44px;min-width:44px;padding:8px 10px;border-radius:24px;display:inline-flex;align-items:center;justify-content:center;gap:8px;line-height:1.3}.bc-root button:focus-visible,.bc-root input:focus-visible{outline:2px solid var(--bc-accent);outline-offset:2px}.bc-root button:hover{background:color-mix(in srgb,var(--bc-accent) 7%,transparent)}.bc-root button svg{width:18px;height:18px;flex-shrink:0}.bc-root .bc-primary{color:var(--bc-accent);background:color-mix(in srgb,var(--bc-accent) 8%,transparent);padding-inline:18px}.bc-root .bc-header{display:flex;align-items:center;justify-content:space-between;flex:none;gap:0}.bc-root .bc-header-actions{display:flex;align-items:center;gap:0}.bc-root .bc-eyebrow{font-size:12px;color:var(--bc-muted);letter-spacing:.5px;min-width:0}.bc-root .bc-mode{font-size:13px;color:var(--bc-accent);padding-inline:8px;min-width:0}.bc-root .bc-body{position:relative;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}.bc-root .bc-scene{position:absolute;inset:0;min-height:160px}.bc-root .bc-line{width:100%;height:100%;display:block;color:var(--bc-accent);overflow:visible}.bc-root .bc-orb{position:absolute;width:46px;height:46px;transform:translate(-50%,-50%);border:1px solid color-mix(in srgb,var(--bc-accent) 25%,transparent);border-radius:50%;color:var(--bc-accent);display:grid;place-items:center;pointer-events:none;background:transparent}.bc-root .bc-orb[data-hold=true]{background:color-mix(in srgb,var(--bc-accent) 7%,transparent)}.bc-root .bc-orb>svg{width:24px;height:26px}.bc-root .bc-orb>svg[data-hold=true]{width:17px;height:22px}.bc-root .bc-guidance{position:absolute;bottom:0;left:0;right:0;text-align:center;padding:4px 10px 2px;pointer-events:none}.bc-root .bc-guidance h2{font-size:clamp(21px,3vw,30px);font-weight:400;line-height:1.2;letter-spacing:-.45px;margin:0 0 8px}.bc-root .bc-guidance p{font-size:14px;line-height:1.65;color:var(--bc-muted);margin:0}.bc-root .bc-guidance p:empty{display:none}.bc-root .bc-guidance p span{display:block;text-wrap:balance}.bc-root .bc-footer{display:flex;align-items:center;justify-content:center;flex:none;gap:6px;font-size:13px}.bc-root .bc-footer button{min-width:0;font-size:13px}.bc-root .bc-quote{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);width:calc(100% - 24px);max-width:410px;line-height:1.7;font-size:19px;font-weight:400;letter-spacing:-.15px;text-align:center;margin:0;overflow-wrap:anywhere}.bc-root .bc-quote strong{font-weight:500;display:inline-block;color:var(--bc-accent)}.bc-root .bc-arrival{position:absolute;transform:translate(-50%,-50%);font-size:19px;line-height:1.7;font-weight:500;color:var(--bc-accent);white-space:nowrap;pointer-events:none}.bc-root .bc-options{flex:none;display:grid;gap:6px;border-block:1px solid color-mix(in srgb,var(--bc-muted) 18%,transparent);padding:8px 4px;color:var(--bc-text);font-size:13px;overflow:auto;max-height:45%}.bc-root .bc-options label{display:flex;align-items:center;min-height:36px;gap:8px;cursor:pointer}.bc-root input{width:18px;height:18px;accent-color:var(--bc-accent)}.bc-root .bc-options small{color:var(--bc-muted);padding-inline-start:26px;font-size:12px}.bc-root .bc-error{font-size:12px;color:var(--bc-muted);flex:none;max-height:50px;overflow:auto}.bc-root .bc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.bc-root[data-stage=intro] .bc-guidance{top:50%;bottom:auto;transform:translateY(-50%)}.bc-root[data-reduced=true] .bc-guidance{top:50%;bottom:auto;transform:translateY(-50%)}.bc-root[data-stage=complete] .bc-guidance{top:auto;bottom:0;transform:none}.bc-root[data-reduced=true] .bc-line,.bc-root[data-reduced=true] .bc-orb,.bc-root[data-reduced=true] .bc-arrival{display:none}
.bc-root[data-compact=true]{padding:8px;gap:2px}.bc-root[data-compact=true] .bc-wide-label{display:none}.bc-root[data-compact=true] .bc-eyebrow{font-size:11px;max-width:105px}.bc-root[data-compact=true] .bc-header-actions button{padding:8px;min-width:40px;width:40px}.bc-root[data-compact=true] .bc-mode{font-size:12px;padding-inline:5px}.bc-root[data-compact=true] .bc-guidance{padding-inline:4px}.bc-root[data-compact=true] .bc-guidance h2{font-size:21px;margin-bottom:5px}.bc-root[data-compact=true] .bc-guidance p{font-size:13px;line-height:1.5}.bc-root[data-compact=true] .bc-quote{font-size:14px;line-height:1.5;width:calc(100% - 12px);top:43%}.bc-root[data-compact=true] .bc-arrival{font-size:14px;line-height:1.5}.bc-root[data-compact=true] .bc-footer button{font-size:12px;gap:5px;padding-inline:8px}.bc-root[data-compact=true][data-stage=complete] .bc-guidance h2{font-size:17px;margin-bottom:0}
.bc-root button.bc-orb{padding:0;pointer-events:auto}.bc-root button.bc-orb:disabled{pointer-events:none}.bc-root[data-compact=true] .bc-header-actions button{min-width:44px;width:44px}
.bc-root .bc-quote-group{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:100%;max-width:434px;padding:4px 12px}.bc-root .bc-quote-group[data-scroll=true]{top:0;transform:translateX(-50%);padding-bottom:16px}.bc-root .bc-quote-group .bc-quote{position:static;transform:none;width:100%;max-width:none;margin:0}.bc-root .bc-finish-title{font-size:23px;line-height:1.3;font-weight:400;letter-spacing:-.4px;text-align:center;margin:18px 0 0}.bc-root[data-compact=true] .bc-finish-title{font-size:17px;margin-top:10px}
`;

// Exact offline renderer, phase icon paths, and live audio lifecycle follow below.

type LiveWind = {
	source: AudioBufferSourceNode;
	gain: GainNode;
	started: number;
	offset: number;
	kind: 'upper' | 'lower' | null;
};
class WindPlayer {
	private context: AudioContext | null = null;
	private master: GainNode | null = null;
	private buffer: AudioBuffer | null = null;
	private preparing: Promise<void> | null = null;
	private active: LiveWind | null = null;
	private voices = new Set<LiveWind>();
	private holds = new Map<'upper' | 'lower', AudioBuffer>();
	private disposed = false;
	async prepare() {
		if (this.disposed) return;
		if (!this.context) {
			if (typeof AudioContext === 'undefined')
				throw new Error('Web Audio unavailable');
			this.context = new AudioContext();
			this.master = this.context.createGain();
			this.master.connect(this.context.destination);
		}
		// Resume immediately inside the user's gesture, before rendering the buffer.
		await this.context.resume();
		if (this.context.state !== 'running')
			throw new Error('Web Audio suspended');
		if (!this.preparing)
			this.preparing = renderWind().then((buffer) => {
				if (!this.disposed) this.buffer = buffer;
			});
		await this.preparing;
	}
	duck(quiet: boolean) {
		if (this.context && this.master && !this.disposed)
			this.master.gain.setTargetAtTime(
				quiet ? 0.3 : 1,
				this.context.currentTime,
				quiet ? 0.1 : 0.3
			);
	}
	stop(seconds = 0.35) {
		const active = this.active;
		this.active = null;
		if (!active || !this.context) return;
		const now = this.context.currentTime;
		active.gain.gain.cancelScheduledValues(now);
		active.gain.gain.setTargetAtTime(0, now, Math.max(0.035, seconds / 5));
		active.source.stop(now + seconds);
	}
	resync() {
		this.stop(0.4);
	}
	private holdBuffer(kind: 'upper' | 'lower') {
		const existing = this.holds.get(kind);
		if (existing) return existing;
		const original = this.buffer!;
		const rate = original.sampleRate,
			duration = 2.5,
			blend = 0.25;
		const buffer = this.context!.createBuffer(2, duration * rate, rate),
			start = kind === 'upper' ? 6 : 16.5;
		for (let channel = 0; channel < 2; channel++) {
			const data = buffer.getChannelData(channel),
				source = original.getChannelData(channel);
			for (let i = 0; i < data.length; i++) {
				const u = i / rate,
					mix = ease((u - (duration - blend)) / blend);
				data[i] =
					source[Math.floor(start * rate) + i] * (1 - mix) +
					source[
						Math.floor(
							(start + Math.max(0, u - duration + blend)) * rate
						)
					] *
						mix;
			}
		}
		this.holds.set(kind, buffer);
		return buffer;
	}
	sync(position: number, kind: 'upper' | 'lower' | null) {
		const context = this.context;
		if (
			this.disposed ||
			!context ||
			context.state !== 'running' ||
			!this.buffer ||
			!this.master
		)
			return;
		if (this.active && this.active.kind === kind) {
			if (kind) return;
			const current =
				this.active.offset + context.currentTime - this.active.started;
			if (Math.abs(modulo(position - current + 10, 20) - 10) < 0.3)
				return;
		}
		this.stop(0.5);
		const source = context.createBufferSource(),
			gain = context.createGain(),
			now = context.currentTime + 0.012;
		source.buffer = kind ? this.holdBuffer(kind) : this.buffer;
		source.loop = true;
		if (kind) {
			source.loopStart = 0.25;
			source.loopEnd = 2.5;
		}
		const offset = kind ? 0.25 : modulo(position, 20);
		gain.gain.value = 0;
		gain.gain.setTargetAtTime(1, now, 0.16);
		source.connect(gain).connect(this.master);
		const active = { source, gain, started: now, offset, kind };
		this.active = active;
		this.voices.add(active);
		source.onended = () => {
			source.disconnect();
			gain.disconnect();
			this.voices.delete(active);
			if (this.active === active) this.active = null;
		};
		source.start(now, offset);
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.voices.forEach((voice) => {
			voice.source.onended = null;
			try {
				voice.source.stop();
			} catch {
				/* Already ended. */
			}
			voice.source.disconnect();
			voice.gain.disconnect();
		});
		this.voices.clear();
		this.active = null;
		this.master?.disconnect();
		if (this.context && this.context.state !== 'closed')
			void this.context.close().catch(() => {});
	}
}

// WIND_RENDER_START: numerically identical to the last approved sound.
const windPresets = [
	{
		name: 'Weicher Hall',
		low: 430,
		high: 1350,
		white: 0.22,
		brown: 2.8,
		body: 0,
		room: 5.2,
		damp: 1800,
		wet: 1.3,
		dry: 0.78,
		power: 1.2,
		attack: 1,
		taper: 0.7
	}
];
async function renderWind(
	preset = windPresets[0],
	sampleRate = 24000
): Promise<AudioBuffer> {
	const Offline =
		typeof OfflineAudioContext === 'undefined' ? null : OfflineAudioContext;
	if (!Offline) throw new Error('Offline audio unavailable');
	const context = new Offline(2, sampleRate * 40, sampleRate),
		smooth = (x: number) =>
			(1 - Math.cos(Math.PI * Math.max(0, Math.min(1, x)))) / 2;
	let seed = 739391;
	const random = () => {
		seed ^= seed << 13;
		seed ^= seed >>> 17;
		seed ^= seed << 5;
		return (seed >>> 0) / 2147483648 - 1;
	};
	const noise = context.createBuffer(1, sampleRate * 20, sampleRate),
		samples = noise.getChannelData(0);
	let brown = 0;
	for (let i = 0; i < samples.length; i++) {
		const white = random();
		brown = (brown + 0.025 * white) / 1.025;
		samples[i] = brown * preset.brown + white * preset.white;
	}
	const source = context.createBufferSource(),
		filter = context.createBiquadFilter(),
		lowCut = context.createBiquadFilter(),
		envelope = context.createGain();
	source.buffer = noise;
	source.loop = true;
	filter.type = 'bandpass';
	filter.Q.value = 0.65;
	lowCut.type = 'highpass';
	lowCut.frequency.value = 110;
	lowCut.Q.value = 0.5;
	source.connect(lowCut).connect(filter).connect(envelope);
	if (preset.body) {
		const body = context.createBiquadFilter(),
			level = context.createGain();
		body.type = 'lowpass';
		body.frequency.value = 500;
		body.Q.value = 0.5;
		level.gain.value = preset.body;
		lowCut.connect(body).connect(level).connect(envelope);
	}
	const gainCurve = new Float32Array(4001),
		frequencyCurve = new Float32Array(4001);
	for (let i = 0; i < gainCurve.length; i++) {
		const time = i / 100,
			local = time % 20,
			p = Math.floor(local / 5),
			t = local - p * 5,
			u = t / 5;
		// The moving breath keeps the original 02 envelope. Each hold has its own fixed-color air layer below.
		const breath =
			p === 0
				? Math.pow(smooth(u), preset.power) *
					(1 - smooth((t - (5 - preset.taper)) / preset.taper))
				: p === 2
					? smooth(t / preset.attack) *
						(1 - 0.76 * smooth(u)) *
						(1 - smooth((t - (5 - preset.taper)) / preset.taper))
					: 0;
		const texture =
			1 - 0.035 * Math.sin(local * 0.61) * Math.sin(local * 0.93);
		gainCurve[i] = 0.32 * breath * texture;
		frequencyCurve[i] =
			p === 0
				? preset.low + (preset.high - preset.low) * smooth(u)
				: p === 1
					? preset.high
					: p === 2
						? preset.high - (preset.high - preset.low) * smooth(u)
						: preset.low;
	}
	envelope.gain.setValueCurveAtTime(gainCurve, 0, 40);
	filter.frequency.setValueCurveAtTime(frequencyCurve, 0, 40);
	const impulse = context.createBuffer(
		2,
		Math.ceil(preset.room * sampleRate),
		sampleRate
	);
	for (let channel = 0; channel < 2; channel++) {
		const data = impulse.getChannelData(channel);
		let soft = 0;
		for (let i = 0; i < data.length; i++) {
			const t = i / sampleRate;
			soft = 0.7 * soft + 0.3 * random();
			data[i] =
				soft *
				Math.exp((-2.8 * t) / preset.room) *
				smooth(t / 0.025) *
				(1 - smooth((t / preset.room - 0.72) / 0.28));
		}
	}
	const dry = context.createGain(),
		reverb = context.createConvolver(),
		damping = context.createBiquadFilter(),
		wet = context.createGain(),
		roomLevel = context.createGain();
	dry.gain.value = preset.dry;
	wet.gain.value = preset.wet;
	reverb.buffer = impulse;
	damping.type = 'lowpass';
	damping.frequency.value = preset.damp;
	damping.Q.value = 0.5;
	envelope.connect(dry).connect(context.destination);
	envelope
		.connect(reverb)
		.connect(damping)
		.connect(wet)
		.connect(roomLevel)
		.connect(context.destination);
	const roomCurve = new Float32Array(4001);
	for (let i = 0; i < roomCurve.length; i++) {
		const local = (i / 100) % 20;
		roomCurve[i] =
			1 -
			0.94 *
				smooth((local - 4.05) / 2.2) *
				(1 - smooth((local - 10) / 1.3));
	}
	roomLevel.gain.setValueCurveAtTime(roomCurve, 0, 40);
	// Independent upper/lower pause paths: frequency is held constant while only level decays.
	function pauseAir(
		start: number,
		center: number,
		highPass: number,
		lowPass: number,
		peak: number,
		{
			lead = 0.85,
			decaySeconds = 3.4,
			releaseAt = 4.1,
			releaseSeconds = 1.35
		} = {}
	) {
		const band = context.createBiquadFilter(),
			floor = context.createBiquadFilter(),
			ceiling = context.createBiquadFilter(),
			level = context.createGain(),
			air = context.createGain(),
			hall = context.createConvolver(),
			hallLevel = context.createGain();
		band.type = 'bandpass';
		band.frequency.value = center;
		band.Q.value = 0.65;
		floor.type = 'highpass';
		floor.frequency.value = highPass;
		floor.Q.value = 0.5;
		ceiling.type = 'lowpass';
		ceiling.frequency.value = lowPass;
		ceiling.Q.value = 0.5;
		lowCut.connect(band).connect(floor).connect(ceiling).connect(level);
		air.gain.value = 0.78;
		level.connect(air).connect(context.destination);
		// A brighter diffusion kernel avoids pulling the upper pause down into the low room tail.
		const tail = context.createBuffer(2, sampleRate * 2, sampleRate);
		for (let c = 0; c < 2; c++) {
			const data = tail.getChannelData(c);
			for (let i = 0; i < data.length; i++) {
				const u = i / data.length;
				data[i] =
					random() *
					Math.exp(-4 * u) *
					smooth(u / 0.012) *
					(1 - smooth((u - 0.72) / 0.28));
			}
		}
		hall.buffer = tail;
		hallLevel.gain.value = 0.28;
		level.connect(hall).connect(hallLevel).connect(context.destination);
		const values = new Float32Array(4001);
		for (let i = 0; i < values.length; i++) {
			const relative =
				((((i / 100 - start + lead) % 20) + 20) % 20) - lead;
			const onset = smooth((relative + lead) / lead),
				decay = Math.exp(-Math.max(0, relative) / decaySeconds),
				release = 1 - smooth((relative - releaseAt) / releaseSeconds);
			values[i] = peak * onset * decay * release;
		}
		level.gain.setValueCurveAtTime(values, 0, 40);
	}
	// Sustain the bright air through the entire upper hold. Its two-second release
	// starts with exhalation, overlapping the rising exhale rather than leaving a gap.
	pauseAir(5, preset.high, 600, 4600, 0.26, {
		lead: 1.4,
		decaySeconds: 9,
		releaseAt: 5,
		releaseSeconds: 2
	});
	pauseAir(15, preset.low, 140, 1600, 0.095);
	source.start(0);
	const rendered = await context.startRendering(),
		loop = context.createBuffer(2, sampleRate * 20, sampleRate);
	let energy = 0,
		count = 0,
		peak = 0;
	// The first cycle fills the reverb. Copy the second, already periodic cycle, so the seam is continuous.
	for (let channel = 0; channel < 2; channel++) {
		const data = loop.getChannelData(channel);
		data.set(
			rendered
				.getChannelData(channel)
				.subarray(sampleRate * 20, sampleRate * 40)
		);
		for (let i = 0; i < data.length; i++) {
			peak = Math.max(peak, Math.abs(data[i]));
			if (Math.floor(i / sampleRate / 5) % 2 === 0) {
				energy += data[i] * data[i];
				count++;
			}
		}
	}
	const scale = Math.min(
		0.024 / Math.max(0.00001, Math.sqrt(energy / count)),
		0.22 / Math.max(0.00001, peak)
	);
	for (let channel = 0; channel < 2; channel++) {
		const data = loop.getChannelData(channel);
		for (let i = 0; i < data.length; i++) data[i] *= scale;
	}
	return loop;
}

// WIND_RENDER_END

const PHASE_ICONS = {
	inhale: {
		viewBox: '0 0 82 107',
		paths: [
			'M9.44189 106.999H7.86611C6.12735 106.999 4.71881 105.591 4.71881 103.852C4.71881 102.113 6.12735 100.705 7.86611 100.705H9.44189C16.2757 100.705 21.9812 95.8603 23.3102 89.4193C22.1524 89.9334 20.7522 89.716 19.8035 88.7672C18.5747 87.5384 18.5747 85.5489 19.8035 84.3158L24.5224 79.5969C25.7512 78.3681 27.7449 78.3681 28.9738 79.5969L33.6969 84.3158C34.9257 85.5488 34.9257 87.5383 33.6969 88.7672C32.6185 89.8456 30.9508 89.9793 29.7304 89.1643C28.4431 99.2248 19.8494 106.999 9.44189 106.999ZM72.3793 100.705H73.9551C75.6938 100.705 77.1024 102.113 77.1024 103.852C77.1024 105.591 75.6938 106.999 73.9551 106.999H72.3793C61.9718 106.999 53.3782 99.2249 52.091 89.1644C50.8706 89.9794 49.2029 89.8457 48.1245 88.7673C46.8957 87.5385 46.8957 85.549 48.1245 84.3159L52.8476 79.597C54.0764 78.3682 56.0701 78.3682 57.299 79.597L62.018 84.3159C63.2467 85.5489 63.2467 87.5384 62.018 88.7673C61.0692 89.7161 59.669 89.9334 58.5112 89.4193C59.8404 95.8602 65.5454 100.705 72.3793 100.705ZM61.3658 59.7942C63.1045 59.7942 64.5131 61.2027 64.5131 62.9415C64.5131 64.6802 63.1045 66.0888 61.3658 66.0888H61.0022C58.649 66.0888 56.4213 67.142 54.9249 68.9602C51.3513 73.3029 46.599 75.5307 40.91 75.5307C35.221 75.5307 30.4692 73.3029 26.8952 68.9602C25.3989 67.1421 23.171 66.0888 20.8179 66.0888H20.4542C18.7155 66.0888 17.3069 64.6802 17.3069 62.9415C17.3069 61.2027 18.7155 59.7942 20.4542 59.7942H20.8179C25.0519 59.7942 29.0644 61.6875 31.7565 64.9602C34.1263 67.8442 37.0981 69.2361 40.91 69.2361C44.7219 69.2361 47.6936 67.8442 50.0635 64.9602C52.7552 61.6875 56.7677 59.7942 61.0022 59.7942H61.3658ZM15.7239 68.0741C17.2328 68.9393 17.7552 70.862 16.8942 72.3708C16.029 73.8798 14.1063 74.4021 12.5975 73.5412L7.05109 70.3689C2.69169 67.8778 0 63.2425 0 58.219C0 53.2911 2.21105 48.6267 6.02292 45.5042L10.7961 41.6004C15.1095 38.0727 17.9225 33.0446 18.6748 27.5278L22.0562 2.72089C22.2903 0.998835 23.8785 -0.204915 25.6006 0.0292007C27.3227 0.263263 28.5306 1.85152 28.2923 3.57358L24.9109 28.3762C23.9454 35.4733 20.3257 41.9395 14.7835 46.4699L10.0104 50.3778C7.65724 52.3005 6.2946 55.1803 6.2946 58.2189C6.2946 60.9816 7.77419 63.5355 10.1733 64.9064L15.7239 68.0741ZM53.5291 3.57347C53.2909 1.85141 54.4988 0.263103 56.2208 0.0290937C57.9429 -0.204969 59.5312 0.998781 59.7652 2.72079L63.1466 27.5277C63.8989 33.0448 66.7118 38.0731 71.0253 41.6003L75.7985 45.5041C79.6104 48.6264 81.8214 53.2908 81.8214 58.2189C81.8214 63.2429 79.1297 67.8781 74.7703 70.3688L69.2239 73.5411C67.715 74.4021 65.7924 73.8797 64.9272 72.3707C64.0662 70.8618 64.5886 68.9392 66.0975 68.074L71.6482 64.9059C74.0473 63.535 75.5269 60.9811 75.5269 58.2184C75.5269 55.1798 74.1644 52.3 71.8111 50.3773L67.038 46.4693C61.4957 41.9385 57.8761 35.473 56.9106 28.3756L53.5291 3.57347Z'
		]
	},
	hold: {
		viewBox: '0 0 68 80',
		paths: [
			'M14.9128 0C23.0784 0 29.7064 6.74688 29.7064 14.9128V65.2096C29.7064 73.3752 23.0782 80.0032 14.9128 80.0032C6.74736 80.0032 0 73.375 0 65.2096V14.9128C0 6.6288 6.62816 0 14.9128 0ZM14.9128 3.55C8.64096 3.55 3.5504 8.63752 3.5504 14.9124V65.2092C3.5504 71.3623 8.63792 76.4532 14.9128 76.4532C21.0659 76.4532 26.1568 71.3657 26.1568 65.2092V14.9124C26.1568 8.64056 21.0693 3.55 14.9128 3.55Z',
			'M52.5436 0C60.8276 0 67.4564 6.74688 67.4564 14.9128V65.2096C67.4564 73.3752 60.7095 80.0032 52.5436 80.0032C44.3777 80.0032 37.75 73.375 37.75 65.2096V14.9128C37.75 6.6288 44.3782 0 52.5436 0ZM52.5436 3.55C46.3905 3.55 41.2996 8.63752 41.2996 14.9124V65.2092C41.2996 71.3623 46.3871 76.4532 52.5436 76.4532C58.8154 76.4532 63.906 71.3657 63.906 65.2092V14.9124C63.906 8.64056 58.8185 3.55 52.5436 3.55Z'
		]
	},
	exhale: {
		viewBox: '0 0 32 32',
		paths: [
			'M6.23462 6.77759C4.10595 9.08911 3 12.3286 3 15.9989C3 19.6691 4.10595 22.9087 6.23462 25.2202C7.2388 26.3106 8.49087 27.2167 10.0029 27.868C10.001 27.9118 10 27.9558 10 28C10 28.9767 10.4667 29.8443 11.1893 30.3921C8.55638 29.6775 6.40454 28.3571 4.76342 26.575C2.22626 23.8199 1 20.06 1 15.9989C1 11.9378 2.22626 8.17785 4.76342 5.42276C7.313 2.65419 11.0952 1 15.9989 1C20.9026 1 24.6848 2.65419 27.2343 5.42276C29.7715 8.17785 30.9978 11.9378 30.9978 15.9989C30.9978 20.06 29.7715 23.8199 27.2343 26.575C25.5939 28.3563 23.4433 29.6763 20.812 30.3912C21.5338 29.8433 22 28.9761 22 28C22 27.9554 21.999 27.9111 21.9971 27.867C23.5081 27.2159 24.7595 26.3101 25.7631 25.2202C27.8918 22.9087 28.9978 19.6691 28.9978 15.9989C28.9978 12.3286 27.8918 9.08911 25.7631 6.77759C23.6469 4.47956 20.4296 3 15.9989 3C11.5681 3 8.35088 4.47956 6.23462 6.77759Z',
			'M13 30C11.981 30 11.1399 29.2379 11.0158 28.2525C11.0054 28.1698 11 28.0855 11 28C11 26.8954 11.8954 26 13 26C14.4872 25.2831 15.195 23.6065 15.4472 22.851L15.4527 22.8342C15.4708 22.7798 15.4864 22.7303 15.4996 22.6867C15.5412 22.5499 15.56 22.47 15.56 22.47C15.77 22.19 16.18 22.19 16.39 22.47C16.39 22.47 16.4088 22.5472 16.4505 22.68C16.4643 22.7239 16.4806 22.7739 16.4996 22.8292L16.5059 22.8474C16.7622 23.5875 17.4793 25.2245 19 26C20.1046 26 21 26.8954 21 28C21 28.0853 20.9947 28.1693 20.9843 28.2517C20.8605 29.2375 20.0193 30 19 30C18.9433 30 18.8872 29.9976 18.8318 29.993C18.7203 30.3109 18.5568 30.6043 18.3516 30.863C17.802 31.5557 16.9529 32 16 32C15.0472 32 14.1982 31.5559 13.6487 30.8633C13.4433 30.6045 13.2798 30.311 13.1682 29.993C13.1128 29.9976 13.0567 30 13 30Z',
			'M17.3802 22.3 17.3889 22.3295C17.7481 21.968 17.97 21.4699 17.97 20.92 17.97 19.8155 17.0745 18.92 15.97 18.92 14.8654 18.92 13.97 19.8155 13.97 20.92 13.97 21.4744 14.1955 21.9761 14.5599 22.3384L14.5675 22.3117C14.5756 22.2831 14.5811 22.2621 14.5843 22.25L14.5872 22.2384 14.6346 22.0373 14.76 21.87C15.37 21.0567 16.58 21.0567 17.19 21.87L17.3132 22.0343 17.3609 22.2306 17.3638 22.2414C17.3668 22.2528 17.3722 22.2726 17.3802 22.3ZM6.97423 9.65811C7.11769 9.22774 7.47625 8.55049 8.06915 7.98761 8.65355 7.4328 9.45199 7 10.4999 7 10.776 7 10.9999 6.77614 10.9999 6.5 10.9999 6.22386 10.776 6 10.4999 6 9.1478 6 8.1129 6.5672 7.38064 7.26239 6.65687 7.94951 6.21542 8.77226 6.02555 9.34189 5.93823 9.60386 6.07981 9.88702 6.34178 9.97434 6.60375 10.0617 6.88691 9.92009 6.97423 9.65811ZM25.0255 9.65811C24.8821 9.22774 24.5235 8.55049 23.9306 7.98761 23.3462 7.4328 22.5478 7 21.4999 7 21.2237 7 20.9999 6.77614 20.9999 6.5 20.9999 6.22386 21.2237 6 21.4999 6 22.852 6 23.8869 6.5672 24.6191 7.26239 25.3429 7.94951 25.7844 8.77226 25.9742 9.34189 26.0616 9.60386 25.92 9.88702 25.658 9.97434 25.396 10.0617 25.1129 9.92009 25.0255 9.65811ZM7.61972 13.2152C7.18626 12.8729 6.55743 12.9469 6.21519 13.3804 5.87295 13.8138 5.9469 14.4427 6.38036 14.7849 7.39624 15.587 8.45824 16 10 16 11.534 16 12.6389 15.5851 13.6321 14.7749 14.0601 14.4258 14.124 13.7959 13.7749 13.368 13.4258 12.94 12.7959 12.8761 12.368 13.2251 11.7506 13.7287 11.0984 14 10 14 8.90948 14 8.28378 13.7395 7.61972 13.2152ZM19.6197 13.2152C19.1863 12.8729 18.5574 12.9469 18.2152 13.3804 17.8729 13.8138 17.9469 14.4427 18.3804 14.7849 19.3962 15.587 20.4582 16 22 16 23.534 16 24.6389 15.5851 25.6321 14.7749 26.0601 14.4258 26.124 13.7959 25.7749 13.368 25.4258 12.94 24.7959 12.8761 24.368 13.2251 23.7506 13.7287 23.0984 14 22 14 20.9095 14 20.2838 13.7395 19.6197 13.2152Z'
		]
	}
} as const;

function PhaseIcon({ phase }: { phase: Phase }) {
	const icon =
		PHASE_ICONS[phase === 0 ? 'inhale' : phase === 2 ? 'exhale' : 'hold'];
	return (
		<svg
			viewBox={icon.viewBox}
			fill="currentColor"
			aria-hidden="true"
			data-hold={phase === 1 || phase === 3}
		>
			{icon.paths.map((d, i) => (
				<path key={i} d={d} />
			))}
		</svg>
	);
}

/*
 * BREATHING PATTERN: inhale 5 s / upper hold 5 s / exhale 5 s / lower rest 5 s.
 * 20 s per automatic cycle, 10 cycles, then the 27.5 s continuous text ending.
 * Manual mode: tap advances the phase; holds can be longer or shorter, no score.
 * COLORS: accent #a5000a; primary text #191c20; secondary text #43474e.
 * Background: transparent. Glow and tints use accent opacity, not more colors.
 * SVG black/white are invisible mask geometry only, never painted UI colors.
 */
