import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { CallParty } from '../callParty';
import { avatarFileOfId } from '../../../utils/avatarChoice';
import { ALL_ANIMAL_FILES } from '../../../utils/anonName/engine';
import { IncomingCallCard } from './IncomingCallCard';
import { MinimizedCallDock } from './MinimizedCallDock';

/**
 * Design proposal (FE#1904): the incoming call and the minimized running
 * call, in the call stage's language. Not wired into `GroupCallWidget` yet —
 * production keeps the old popup until Frank has approved this.
 *
 * Each state renders over a sample app page so the stacking can be judged:
 * the surface is portalled to `<body>`, above the shell, below dialogs.
 */

/** A counsellor as an advice seeker sees them: initials on primary. */
const counsellor: CallParty = {
	name: 'Frau Keller',
	avatar: {
		userId: '@keller:matrix.storybook.test',
		username: 'keller',
		displayName: 'Frau Keller',
		avatarDisplayName: 'Anna Keller',
		choice: { kind: 'initials' }
	}
};

/** An advice seeker as a counsellor sees them: their animal and colour. */
const seeker: CallParty = {
	name: 'ruhiger Fuchs 432',
	avatar: {
		userId: '@fuchs432:matrix.storybook.test',
		username: 'fuchs432',
		displayName: 'ruhiger Fuchs 432',
		choice: {
			kind: 'animal',
			file: avatarFileOfId('fox') ?? ALL_ANIMAL_FILES[0]
		}
	}
};

const SampleAppPage: React.FC = () => (
	<div
		aria-hidden="true"
		className="sample-app-page"
		style={{
			// Its own stacking context, as the app shell has one.
			position: 'relative',
			zIndex: 0,
			minHeight: '100vh',
			background: 'var(--m3-surface-container-low, #f6f3f3)',
			fontFamily: 'Inter, sans-serif',
			color: '#1a1c1e'
		}}
	>
		<div
			style={{
				height: 64,
				display: 'flex',
				alignItems: 'center',
				padding: '0 20px',
				background: '#fff',
				boxShadow: '0 1px 2px rgba(0,0,0,.08)',
				fontSize: 18,
				fontWeight: 500
			}}
		>
			Meine Beratungen
		</div>
		<div style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 720 }}>
			{[
				['Suchtberatung · Gruppe', 'Läuft gerade — 4 Teilnehmende'],
				[
					'Frau Keller · Schuldnerberatung',
					'Ich schicke Ihnen den Link …'
				],
				['wacher Igel 118', 'Danke für gestern — hat geholfen.'],
				['Erziehungsberatung', 'Termin am Donnerstag, 10:00']
			].map(([title, line]) => (
				<div
					key={title}
					style={{
						background: '#fff',
						borderRadius: 12,
						padding: '14px 16px'
					}}
				>
					<div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
					<div
						style={{ fontSize: 13, color: '#666469', marginTop: 2 }}
					>
						{line}
					</div>
				</div>
			))}
		</div>
		<nav className="sample-bottom-nav">
			{['Beratung', 'Termine', 'Nachrichten', 'Profil'].map((label) => (
				<span key={label}>{label}</span>
			))}
		</nav>
		<style>{`
			.sample-bottom-nav { display: none; }
			@media (max-width: 599px) {
				.sample-bottom-nav {
					position: fixed; left: 0; right: 0; bottom: 0; height: 64px;
					display: flex; justify-content: space-around; align-items: center;
					background: #fff; box-shadow: 0 -1px 2px rgba(0,0,0,.08);
					font-size: 12px; color: #444748;
				}
			}
		`}</style>
	</div>
);

const meta = {
	title: 'Components/Call/Call states',
	parameters: {
		layout: 'fullscreen',
		/*
		 * The page behind is a stand-in, not the product: where a card or the
		 * menu covers it, axe cannot see its background and gives up. Only
		 * `color-contrast` skips it; the call surfaces are audited in full.
		 */
		a11y: {
			config: {
				rules: [
					{
						id: 'color-contrast',
						selector: '*:not(.sample-app-page *)'
					}
				]
			}
		}
	},
	decorators: [
		(Story) => (
			<>
				<SampleAppPage />
				<Story />
			</>
		)
	]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PHONE_412 = { viewport: { value: 'phone412', isRotated: false } };
const PHONE_320 = { viewport: { value: 'phone320', isRotated: false } };

/* ── Incoming ─────────────────────────────────────────────────────────── */

export const IncomingVideoCall: Story = {
	render: () => (
		<IncomingCallCard
			caller={counsellor}
			isVideo
			onAnswer={fn()}
			onDecline={fn()}
		/>
	),
	play: async () => {
		const body = within(document.body);
		await waitFor(() =>
			expect(
				body.getByRole('alertdialog', { name: 'Frau Keller' })
			).toBeTruthy()
		);
		// Portalled out of the story root: no transformed parent can trap it.
		const card = document.querySelector('.incoming-call-card');
		expect(card?.closest('#storybook-root')).toBeNull();
	}
};
export const IncomingVideoCallPhone412: Story = {
	...IncomingVideoCall,
	globals: PHONE_412
};
export const IncomingVideoCallPhone320: Story = {
	...IncomingVideoCall,
	globals: PHONE_320
};

export const IncomingAudioCall: Story = {
	render: () => (
		<IncomingCallCard
			caller={seeker}
			isVideo={false}
			onAnswer={fn()}
			onDecline={fn()}
		/>
	)
};
export const IncomingAudioCallPhone412: Story = {
	...IncomingAudioCall,
	globals: PHONE_412
};
export const IncomingAudioCallPhone320: Story = {
	...IncomingAudioCall,
	globals: PHONE_320
};

/** Somebody we cannot name: a neutral glyph and the generic line, no "G". */
export const IncomingUnknownCaller: Story = {
	render: () => (
		<IncomingCallCard
			caller={null}
			isVideo
			onAnswer={fn()}
			onDecline={fn()}
		/>
	),
	play: async () => {
		await waitFor(() =>
			expect(
				document.querySelector('.incoming-call-card__unknown')
			).toBeTruthy()
		);
		expect(
			document.querySelector(
				'.incoming-call-card [data-testid="user-avatar"]'
			)
		).toBeNull();
	}
};
export const IncomingUnknownCallerPhone412: Story = {
	...IncomingUnknownCaller,
	globals: PHONE_412
};
export const IncomingUnknownCallerPhone320: Story = {
	...IncomingUnknownCaller,
	globals: PHONE_320
};

/**
 * Proposal only: `CallManager.receiveCall` ignores a second call while one
 * runs, so nobody sees this today. It shows what the card would say if the
 * second call were let through.
 */
export const IncomingWhileInCall: Story = {
	render: () => (
		<>
			<MinimizedCallDock
				party={seeker}
				elapsedSeconds={724}
				isMuted={false}
				onToggleMute={fn()}
				onHangUp={fn()}
				onExpand={fn()}
			/>
			<IncomingCallCard
				caller={counsellor}
				isVideo={false}
				ongoingCall={{ name: seeker.name, avatars: [seeker.avatar] }}
				onAnswer={fn()}
				onDecline={fn()}
			/>
		</>
	)
};
/**
 * Phone: the note wraps, and axe 4.7 compares the whole element stack per
 * text line, including the app page behind the opaque card. The two lines sit
 * over different list items, so it gives up ("partially overlaps"), as in
 * `KnockWaitDialog.stories.tsx`. Only `color-contrast` is scoped away from
 * that note; the desktop story above still audits it.
 */
const busyNoteOverThePage = {
	a11y: {
		config: {
			rules: [
				{
					id: 'color-contrast',
					selector:
						'*:not(.sample-app-page *):not(.incoming-call-card__busy p)'
				}
			]
		}
	}
};
export const IncomingWhileInCallPhone412: Story = {
	...IncomingWhileInCall,
	globals: PHONE_412,
	parameters: busyNoteOverThePage
};
export const IncomingWhileInCallPhone320: Story = {
	...IncomingWhileInCall,
	globals: PHONE_320,
	parameters: busyNoteOverThePage
};

/** Two more group members, by the same identity rules. */
const groupMember = (id: string, animal: string): CallParty['avatar'] => ({
	userId: `@${id}:matrix.storybook.test`,
	username: id,
	displayName: id,
	choice: {
		kind: 'animal',
		file: avatarFileOfId(animal) ?? ALL_ANIMAL_FILES[1]
	}
});

/** The same, with a group call running: the group's stack is struck through. */
export const IncomingWhileInGroupCall: Story = {
	render: () => (
		<IncomingCallCard
			caller={counsellor}
			isVideo
			ongoingCall={{
				name: 'Suchtberatung · Gruppe',
				avatars: [
					seeker.avatar,
					groupMember('igel118', 'hedgehog'),
					groupMember('eule7', 'owl')
				]
			}}
			onAnswer={fn()}
			onDecline={fn()}
		/>
	)
};
export const IncomingWhileInGroupCallPhone412: Story = {
	...IncomingWhileInGroupCall,
	globals: PHONE_412,
	parameters: busyNoteOverThePage
};
export const IncomingWhileInGroupCallPhone320: Story = {
	...IncomingWhileInGroupCall,
	globals: PHONE_320,
	parameters: busyNoteOverThePage
};

/* ── Minimized ────────────────────────────────────────────────────────── */

const MinimizedHarness: React.FC<{ isSpeaking?: boolean }> = ({
	isSpeaking
}) => {
	const [isMuted, setIsMuted] = React.useState(false);
	const [isCameraOff, setIsCameraOff] = React.useState(false);
	return (
		<MinimizedCallDock
			party={seeker}
			elapsedSeconds={724}
			isMuted={isMuted}
			isVideo
			isCameraOff={isCameraOff}
			isSpeaking={isSpeaking}
			onToggleMute={() => setIsMuted((muted) => !muted)}
			onToggleCamera={() => setIsCameraOff((off) => !off)}
			onHangUp={fn()}
			onExpand={fn()}
		/>
	);
};

export const MinimizedCall: Story = {
	render: () => <MinimizedHarness />,
	play: async () => {
		const body = within(document.body);
		const mute = await body.findByRole('button', { name: /stumm|mute/i });
		expect(mute.getAttribute('aria-pressed')).toBe('false');
		expect(body.getByText('12:04')).toBeTruthy();
	}
};
export const MinimizedCallPhone412: Story = {
	...MinimizedCall,
	globals: PHONE_412
};
export const MinimizedCallPhone320: Story = {
	...MinimizedCall,
	globals: PHONE_320
};

/** The ⋮ menu: what the host can still steer from outside the call. */
export const MinimizedMenuOpen: Story = {
	render: () => <MinimizedHarness />,
	play: async () => {
		const body = within(document.body);
		const more = await body.findByRole('button', {
			name: /weitere optionen|more options/i
		});
		await userEvent.click(more);
		await waitFor(() =>
			expect(document.querySelector('.call-dock-menu')).toBeTruthy()
		);
		expect(
			body.getByRole('menuitem', {
				name: /video ausschalten|turn off video/i
			})
		).toBeTruthy();
	}
};
export const MinimizedMenuOpenPhone412: Story = {
	...MinimizedMenuOpen,
	globals: PHONE_412
};
export const MinimizedMenuOpenPhone320: Story = {
	...MinimizedMenuOpen,
	globals: PHONE_320
};

export const MinimizedWhileOtherSpeaks: Story = {
	render: () => <MinimizedHarness isSpeaking />
};
export const MinimizedWhileOtherSpeaksPhone412: Story = {
	...MinimizedWhileOtherSpeaks,
	globals: PHONE_412
};
export const MinimizedWhileOtherSpeaksPhone320: Story = {
	...MinimizedWhileOtherSpeaks,
	globals: PHONE_320
};
