import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';

import { Gespraechsnotizen } from './Gespraechsnotizen';
import { HainStage, type CallParticipant } from '../stages/HainStage';
import { pickIconColor } from '../../../utils/pseudonymGenerator';

/**
 * Gesprächsnotizen (6) — the counsellor's private scratchpad.
 *
 * **Private is the feature.** The ticket is blunt about what this is not: not
 * a shared agenda, not a transcript, not minutes. The advice seeker never
 * sees it and it is never sent anywhere. The notes live in component state
 * for the duration of the call and then they end — there is no persistence
 * here and none is planned.
 *
 * The one way anything leaves is the copy button, which puts the whole pad on
 * the clipboard as plain text grouped by type, ready to paste into a case
 * file. `Gespraechsnotizen.test.tsx` holds that claim to account: it watches
 * `fetch`, `XMLHttpRequest`, `sendBeacon` and both Web Storages while a note
 * is written, listed and copied, and asserts nothing was touched.
 *
 * Three types — **Frage · Anmerkung · Aufgabe** — and no fourth. They render
 * as words in quiet colours, never as a colour dot, because colour alone is
 * not a label and in a hurry it is not read at all.
 *
 * The `⋮` menu is the composer's `ToolbarMenu`, not a second dropdown: it
 * already flips instead of running off a phone screen, portals out of its
 * ancestors' overflow, closes on Escape and announces its entries as
 * `menuitemradio`.
 */
const meta: Meta<typeof Gespraechsnotizen> = {
	title: 'Call/Notizen',
	component: Gespraechsnotizen,
	parameters: { layout: 'centered' }
};

export default meta;
type Story = StoryObj<typeof Gespraechsnotizen>;

/*
 * German copy, as a counsellor would read it. In the app these come from the
 * translation files; a story has no i18n provider, so they are passed in —
 * which is also why the component takes labels as a prop rather than calling
 * `useTranslation` itself.
 */
const labels = {
	title: 'Gesprächsnotizen',
	privacy: 'Privat. Nur für Sie und nur für die Dauer des Gesprächs.',
	type: 'Art der Notiz',
	text: 'Notiz',
	add: 'Notiz hinzufügen',
	remove: 'Notiz entfernen',
	copy: 'Alles kopieren',
	copied: 'Kopiert',
	empty: 'Noch nichts notiert.',
	collapse: 'Notizen einklappen',
	expand: 'Notizen ausklappen',
	types: { frage: 'Frage', anmerkung: 'Anmerkung', aufgabe: 'Aufgabe' }
};

/** The pad at the start of a call: the lock line, the field, nothing else. */
export const Leer: Story = { args: { labels } };

/**
 * Collapsed to the rail.
 *
 * The notes survive the collapse — this is a rail, not a reset. The 44px
 * matches the view switcher's rail from the handoff, so the two docked edges
 * of the call line up.
 */
export const Rail: Story = { args: { labels, defaultCollapsed: true } };

/**
 * Written in, so the three type colours can be compared side by side.
 *
 * Typed through the real controls rather than seeded through a prop: the
 * component has no way to be handed notes from outside, which is the same
 * reason nothing can hand them to a server.
 */
export const Beschrieben: Story = {
	args: { labels },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const user = userEvent.setup();

		const entries = [
			[
				'Anmerkung',
				'wirkt erschöpft, spricht langsamer als beim letzten Mal'
			],
			['Frage', 'Wohnsituation seit dem Umzug?'],
			['Aufgabe', 'Rückruf am Montag, Beratungsstelle Nord weitergeben']
		] as const;

		for (const [type, text] of entries) {
			await user.click(
				canvas.getByRole('button', { name: /^Art der Notiz:/ })
			);
			await user.click(
				await within(document.body).findByRole('menuitemradio', {
					name: type
				})
			);
			await user.type(
				canvas.getByRole('textbox', { name: labels.text }),
				text
			);
			await user.click(canvas.getByRole('button', { name: labels.add }));
		}
	}
};

const person = (name: string, file: string, bg: string): CallParticipant => ({
	name,
	avatar: { file, bg, iconColor: pickIconColor(bg) },
	speaking: false
});

const ROOM: CallParticipant[] = [
	person('wacher Igel 118', 'hedgehog.svg', '#FCE7E6'),
	person('ruhiger Fuchs 432', 'fox.svg', '#D6E9CA'),
	person('später Kauz 512', 'owl.svg', '#BBBCDE'),
	person('klarer Schwan 77', 'swan.svg', '#F0DC82'),
	person('naher Otter 303', 'otter.svg', '#1F3134'),
	person('stilles Pferd 907', 'horse.svg', '#6E2A3A')
];

/*
 * `HainStage` is sized by a `box` prop in pixels, not by its container, so a
 * story that hardcodes it cannot show the stage reflowing — it would only
 * show the panel failing to cover a stage that was never going to move.
 *
 * Measuring the free width is the stage shell's job (ticket 05). Until the
 * shell exists this stands in for it, deliberately small and deliberately
 * here rather than in the stage: the stage's own contract stays unchanged,
 * and when the shell lands it replaces these few lines.
 */
const useFreeBox = (): [React.RefObject<HTMLDivElement>, number] => {
	const ref = React.useRef<HTMLDivElement>(null);
	const [box, setBox] = React.useState(0);
	React.useEffect(() => {
		const host = ref.current;
		if (!host || typeof ResizeObserver === 'undefined') return;
		// The Hain is square, so the smaller of the two free dimensions is
		// what binds. On a 1280x700 desktop that is the height — which is
		// why collapsing the panel widens the stage's margins rather than
		// growing the shapes. Worth knowing before anyone reads the freed
		// width as wasted.
		const measure = () =>
			setBox(Math.min(host.clientWidth, host.clientHeight));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(host);
		return () => observer.disconnect();
	}, []);
	return [ref, box];
};

/**
 * The acceptance criterion, measured rather than asserted: **"the panel never
 * covers the stage on a 1280 px screen; the stage reflows."**
 *
 * The panel is a docked flex sibling with `position: static` — it is not in a
 * layer and has no way to be in one, so it cannot cover anything. The stage
 * takes the width that is left, and collapsing the panel to the rail hands it
 * the freed space.
 *
 * `scripts/shootCallStages.mjs` checks both halves of that sentence in a real
 * browser: the two rectangles must not intersect, and the stage must actually
 * get wider when the panel collapses.
 */
export const NebenDerBuehne: Story = {
	args: { labels },
	parameters: {
		layout: 'fullscreen',
		viewport: { defaultViewport: 'desktop' }
	},
	render: (args) => <BuehneMitNotizen {...args} />
};

/* A named component, because the hook above has to live in one. */
const BuehneMitNotizen = (
	args: React.ComponentProps<typeof Gespraechsnotizen>
) => {
	const [hostRef, free] = useFreeBox();
	return (
		<div
			style={{
				display: 'flex',
				gap: 16,
				alignItems: 'stretch',
				inlineSize: 1280,
				blockSize: 680,
				padding: 16,
				boxSizing: 'border-box',
				background: '#f0edee'
			}}
		>
			<div
				ref={hostRef}
				data-testid="stage-area"
				style={{
					flex: 1,
					minInlineSize: 0,
					display: 'flex',
					justifyContent: 'center'
				}}
			>
				{free > 0 && (
					<HainStage
						participants={ROOM}
						box={free}
						atmosphere="lichtung"
					/>
				)}
			</div>
			<Gespraechsnotizen {...args} />
		</div>
	);
};
