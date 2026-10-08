/**
 * The chat header's main interaction icon as an atom — one story per variant
 * of the Figma component set "Chatroom Main Interaction icon"
 * (App.Oriso 7608-40827, page Components, section "Chat Room Molecules").
 *
 * Every story renders the production `ChatroomMainInteractionIcon` exactly as
 * `SessionHeaderComponent` wires it for that state; nothing here restyles it.
 * Where the shipped rendering differs from the Figma variant, the difference
 * is written into the story's docs so the design owner can decide it — it is
 * not silently "fixed" in the story.
 *
 * The FE#513 add-button states (disabled for askers, on mobile, without
 * supervision) stay in `Components/Session/ChatroomMainInteractionIcon`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { ChatroomMainInteractionIcon } from './ChatroomMainInteractionIcon';
import './sessionHeader.styles.scss';

const FIGMA_FILE =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso';

const figmaVariant = (nodeId: string) => ({
	design: {
		type: 'figma' as const,
		url: `${FIGMA_FILE}?node-id=${nodeId}&m=dev`
	}
});

/** The German label production passes when the consultant may add a supervisor. */
const ADD_LABEL = 'Supervisor verwalten';

const pillOf = (canvasElement: HTMLElement): HTMLElement => {
	const pill = canvasElement.querySelector<HTMLElement>(
		'.chatroomMainInteractionIcon'
	);
	if (!pill) {
		throw new Error('ChatroomMainInteractionIcon did not render');
	}
	return pill;
};

const meta: Meta<typeof ChatroomMainInteractionIcon> = {
	title: 'Chat/Atoms/ChatroomMainInteractionIcon',
	component: ChatroomMainInteractionIcon,
	tags: ['autodocs'],
	parameters: {
		...figmaVariant('7608-40827'),
		docs: {
			description: {
				component:
					'Die Hauptinteraktion oben links im Chatraum: optional der „+“-Knopf (Supervisor hinzufügen) und das Symbol für den Zustand des Gesprächs. Eine Story je Variante der Figma-Komponente „Chatroom Main Interaction icon“.'
			}
		}
	},
	argTypes: {
		type: {
			control: 'select',
			options: ['nearby', 'live', 'internal', 'waiting', 'inquiry']
		}
	}
};

export default meta;
type Story = StoryObj<typeof ChatroomMainInteractionIcon>;

/**
 * Figma "Header IconState=Active Conversation" (7608-40438): an accepted 1:1
 * conversation — the "+" and the conversation-type glyph.
 *
 * Deviations: Figma draws a house (`nearby_conv_type_200`), production draws
 * an envelope (`mail_conv_type_200`) since the Mail modality change (#1148).
 * The pill is 76 px wide instead of 73.5 px (`min-width: 76px`), which moves
 * the "+" and the glyph 1 px to the right.
 */
export const AktiveBeratung: Story = {
	name: 'Aktive Beratung',
	parameters: figmaVariant('7608-40438'),
	args: {
		type: 'nearby',
		showAddIcon: true,
		addLabel: ADD_LABEL,
		onAddClick: fn()
	},
	play: async ({ args, canvas, canvasElement }) => {
		const pill = pillOf(canvasElement);
		await expect(pill).toHaveClass(
			'chatroomMainInteractionIcon--nearby',
			'chatroomMainInteractionIcon--withAdd'
		);
		// The conversation type is an image glyph, not a drawn state marker.
		await expect(
			pill.querySelector('.chatroomMainInteractionIcon__typeMask')
		).not.toBeNull();
		const add = canvas.getByRole('button', { name: ADD_LABEL });
		await expect(add).toBeEnabled();
		await userEvent.click(add);
		await expect(args.onAddClick).toHaveBeenCalledTimes(1);
		// Leave the story at rest: the programmatic click leaves a focus ring
		// that the Figma variant does not have.
		add.blur();
	}
};

/**
 * Figma "Header IconState=Waiting Room + Add" (7608-40828): an empty enquiry
 * (the advice seeker has not written yet) with the "+".
 *
 * Deviations: Figma's clock is a thin solid arc on the right half and a
 * dotted arc in the dark secondary tone on the left half; production draws a
 * full 2 px ring whose left side is 40 % white, with 2 px hands. The pill is
 * 76 px wide instead of 74 px.
 */
export const WarteraumMitHinzufuegen: Story = {
	name: 'Warteraum mit „+“',
	parameters: figmaVariant('7608-40828'),
	args: {
		type: 'waiting',
		showAddIcon: true,
		addLabel: ADD_LABEL,
		onAddClick: fn()
	},
	play: async ({ canvas, canvasElement }) => {
		const pill = pillOf(canvasElement);
		await expect(pill).toHaveClass(
			'chatroomMainInteractionIcon--waiting',
			'chatroomMainInteractionIcon--withAdd'
		);
		await expect(
			canvas.getByRole('button', { name: ADD_LABEL })
		).toBeEnabled();
		// The clock is drawn in CSS, not taken from an image.
		await expect(
			pill.querySelector('.chatroomMainInteractionIcon__typeMask')
		).toBeNull();
	}
};

/**
 * Figma "Header IconState=Inquiry + Add" (7608-41037): an enquiry with a
 * first message, with the "+".
 *
 * Deviations: Figma's magnet is a red "C" (a 5 px bar plus red arm stubs)
 * with grey gradient tips; production draws a 7 px red bar (from x = 3 px
 * instead of 4 px in its 24 px box) with flat grey arms. The pill is 76 px
 * wide instead of 74 px. Open PR #1418 replaces this glyph with a horseshoe
 * outline.
 */
export const AnfrageMitHinzufuegen: Story = {
	name: 'Anfrage mit „+“',
	parameters: figmaVariant('7608-41037'),
	args: {
		type: 'inquiry',
		showAddIcon: true,
		addLabel: ADD_LABEL,
		onAddClick: fn()
	},
	play: async ({ canvas, canvasElement }) => {
		const pill = pillOf(canvasElement);
		await expect(pill).toHaveClass(
			'chatroomMainInteractionIcon--inquiry',
			'chatroomMainInteractionIcon--withAdd'
		);
		await expect(
			canvas.getByRole('button', { name: ADD_LABEL })
		).toBeEnabled();
		await expect(
			pill.querySelector('.chatroomMainInteractionIcon__typeMask')
		).toBeNull();
	}
};

/**
 * Figma "Header IconState=Waiting Room" (7608-40934): an empty enquiry,
 * no "+" — the narrow, darker pill.
 *
 * Deviation: Figma's dotted left half has the pill's own colour, so only the
 * right half arc is visible; production shows the full ring (see above).
 */
export const Warteraum: Story = {
	name: 'Warteraum',
	parameters: figmaVariant('7608-40934'),
	args: {
		type: 'waiting',
		showAddIcon: false
	},
	play: async ({ canvas, canvasElement }) => {
		const pill = pillOf(canvasElement);
		await expect(pill).toHaveClass('chatroomMainInteractionIcon--waiting');
		await expect(pill).not.toHaveClass(
			'chatroomMainInteractionIcon--withAdd'
		);
		await expect(canvas.queryByRole('button')).toBeNull();
	}
};

/**
 * Figma "Header IconState=Inquiry" (7608-40985): an enquiry with a first
 * message, no "+" — the narrow, darker pill with the magnet.
 *
 * Deviation: the same magnet difference as "Anfrage mit „+“".
 */
export const Anfrage: Story = {
	name: 'Anfrage',
	parameters: figmaVariant('7608-40985'),
	args: {
		type: 'inquiry',
		showAddIcon: false
	},
	play: async ({ canvas, canvasElement }) => {
		const pill = pillOf(canvasElement);
		await expect(pill).toHaveClass('chatroomMainInteractionIcon--inquiry');
		await expect(pill).not.toHaveClass(
			'chatroomMainInteractionIcon--withAdd'
		);
		await expect(canvas.queryByRole('button')).toBeNull();
	}
};
