import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { UserAvatar } from '../../message/UserAvatar';
import { SessionCardBody } from './SessionCardBody';
import {
	SESSION_CARD_GEOMETRY,
	SessionCardGeometry,
	sessionCardPreviewIndents
} from './sessionCardGeometry';

const FIGMA_SESSION_LIST =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7086-57413';

/**
 * The body of a session card, on its own: avatar, name, a preview clamped to
 * three lines on a diagonal, and marks on the last line. The list item
 * (`SessionListItem`) fills these slots; the geometry lives here only.
 */
const meta = {
	title: 'Components/Session/List/SessionCardBody',
	component: SessionCardBody,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		design: { type: 'figma', url: FIGMA_SESSION_LIST }
	}
} satisfies Meta<typeof SessionCardBody>;

export default meta;
type Story = StoryObj<typeof meta>;

const PREVIEWS = [
	'Danke!',
	'Hallo, hätten Sie nächste Woche einen Termin für mich?',
	'Guten Morgen, ich habe gestern mit meiner Schwester gesprochen und wir würden gerne gemeinsam zu einem Gespräch kommen.',
	'Hallo, ich wollte fragen ob wir noch einmal über die Situation zu Hause sprechen können. Seit letzter Woche ist es wieder schwieriger geworden und ich weiß gerade nicht weiter.',
	'https://www.beispiel-beratung.de/termine/familienberatung/2026/september/buchung?ref=abcdefghijklmnopqrstuvwxyz'
];

/** A card frame like the list's, with the menu pill's 10 px inset. */
const Card = ({
	text,
	geometry,
	action
}: {
	text: string;
	geometry?: SessionCardGeometry;
	action?: React.ReactNode;
}) => (
	<div
		data-card
		style={
			{
				'--card-trailing': '10px',
				'width': 424,
				'marginBottom': 12,
				'borderRadius': 24,
				'background': '#eae7e8',
				'border': '1px solid #fff',
				'fontSize': 12
			} as React.CSSProperties
		}
	>
		<SessionCardBody
			geometry={geometry}
			avatar={
				<UserAvatar
					username="ruhiges-yak-kim"
					displayName="ruhiges Yak Kim"
					userId="asker-4401"
					size={`${(geometry ?? SESSION_CARD_GEOMETRY).avatar}px`}
					ring={false}
					outline={false}
				/>
			}
			name={<span style={{ fontSize: 16 }}>ruhiges Yak Kim</span>}
			preview={action ? undefined : <div data-preview>{text}</div>}
			action={action}
			trailing={<span style={{ fontWeight: 600 }}>Mail</span>}
		/>
	</div>
);

/** Glyph box and text on one line count as one line. */
const previewLines = (card: HTMLElement) => {
	const range = document.createRange();
	range.selectNodeContents(card.querySelector('[data-preview]')!);
	const flow = card
		.querySelector<HTMLElement>('.sessionCard__flow')!
		.getBoundingClientRect();
	const lefts: number[] = [];
	let lastTop = -Infinity;
	for (const rect of Array.from(range.getClientRects())) {
		if (rect.width === 0 || rect.top >= flow.bottom - 0.5) continue;
		if (Math.abs(rect.top - lastTop) < 4) continue;
		lastTop = rect.top;
		lefts.push(rect.left);
	}
	return lefts;
};

const expectPreviewsFollowGeometry = async (
	canvasElement: HTMLElement,
	geometry: SessionCardGeometry
) => {
	const cards = await waitFor(() => {
		const found = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('[data-card]')
		);
		expect(found.length).toBeGreaterThan(0);
		return found;
	});
	const indents = sessionCardPreviewIndents(geometry);
	for (const card of cards) {
		const avatar = card
			.querySelector<HTMLElement>('.sessionCard__avatar')!
			.getBoundingClientRect();
		const lefts = previewLines(card);
		await expect(lefts.length).toBeGreaterThan(0);
		await expect(lefts.length).toBeLessThanOrEqual(geometry.previewLines);
		for (const [line, left] of lefts.entries()) {
			await expect(Math.round(left - avatar.left)).toBe(indents[line]);
		}
	}
};

/** Five preview lengths: one word to a long unbroken link. */
export const AllPreviews: Story = {
	name: 'Vorschau — ein Wort bis drei Zeilen und mehr',
	args: { avatar: null, name: null },
	render: () => (
		<div>
			{PREVIEWS.map((text) => (
				<Card key={text} text={text} />
			))}
		</div>
	),
	play: async ({ canvasElement }) =>
		expectPreviewsFollowGeometry(canvasElement, SESSION_CARD_GEOMETRY)
};

/**
 * The same card with a 16 px gap: every step moves with it. Proves the
 * diagonal comes from the geometry, not from numbers in the stylesheet.
 */
export const WiderGap: Story = {
	name: 'Geometrie — 16 px Abstand verschiebt alle Stufen',
	args: { avatar: null, name: null },
	render: () => (
		<Card
			text={PREVIEWS[3]}
			geometry={{ ...SESSION_CARD_GEOMETRY, gap: 16 }}
		/>
	),
	play: async ({ canvasElement }) =>
		expectPreviewsFollowGeometry(canvasElement, {
			...SESSION_CARD_GEOMETRY,
			gap: 16
		})
};

/** The case-handover action takes the preview's place, on the last line. */
export const WithAction: Story = {
	name: 'Aktion statt Vorschau (Fallübergabe)',
	args: { avatar: null, name: null },
	render: () => (
		<Card
			text=""
			action={
				<button type="button" style={{ height: 40, borderRadius: 20 }}>
					Zugriff anfragen
				</button>
			}
		/>
	),
	play: async ({ canvasElement }) => {
		const action = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.sessionCard__action'
			);
			expect(element).toBeTruthy();
			return element!;
		});
		const mark = canvasElement
			.querySelector<HTMLElement>('.sessionCard__trailing')!
			.getBoundingClientRect();
		const box = action.getBoundingClientRect();
		// Centred on the same line as the marks.
		await expect(
			Math.abs((box.top + box.bottom) / 2 - (mark.top + mark.bottom) / 2)
		).toBeLessThanOrEqual(1);
		await expect(box.right).toBeLessThanOrEqual(mark.left);
	}
};
