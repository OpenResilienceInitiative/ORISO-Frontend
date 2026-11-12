/**
 * The real call views, without a call (ORISO-Frontend#2233).
 *
 * The call screens live in the ORISO-ElementCall fork. Its proof pages
 * (`harness/*.html`) render those very components with made-up people and
 * no Matrix or LiveKit behind them; CI builds them into
 * `storybook-static/call-harness` (see `.github/actions/call-harness`). This
 * story frames them with controls, so the views can be judged at any head
 * count without arranging a real call.
 *
 * An iframe for the same reason as `ElementCallEmbed.stories.tsx`: importing
 * the call components would put a second dependency tree and design system
 * into this build. The animals still come from this Storybook's own
 * `/static/anon-animals`, because the pages read them from the embedding
 * origin — the same drawings the chat shows.
 *
 * Locally the pages are missing unless built: run `yarn build:harness` in an
 * ORISO-ElementCall checkout and copy `dist-harness` to
 * `storybook-static/call-harness`, or point `STORYBOOK_CALL_HARNESS_URL` at a
 * running harness server.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

type Situation = 'group' | 'oneOnOne';

interface CallViewArgs {
	situation: Situation;
	participants: number;
	view: 'kreis' | 'hain' | 'felder' | 'kacheln';
	media: 'audio' | 'video';
	callType: 'group' | 'single';
	speaking: number;
	notes: boolean;
	phone: boolean;
}

const configuredBase = (
	(import.meta.env.STORYBOOK_CALL_HARNESS_URL as string | undefined) ||
	'./call-harness'
).replace(/\/+$/, '');

/** The harness address for the chosen situation. */
const harnessUrl = (base: string, args: CallViewArgs): string => {
	const query = new URLSearchParams({ call: args.media });
	if (args.phone) query.set('mobile', '1');
	if (args.situation === 'oneOnOne') {
		query.set('header', '1');
		query.set('speaking', args.speaking === 0 ? 'first' : 'second');
		if (args.notes) query.set('notes', 'docked');
		return `${base}/harness/einzelCall.html?${query.toString()}`;
	}
	query.set('n', String(args.participants));
	query.set('view', args.view);
	query.set('type', args.callType);
	query.set('speaking', String(args.speaking));
	if (args.notes) query.set('notes', '1');
	return `${base}/harness/buehne.html?${query.toString()}`;
};

/**
 * Whether the built pages are there. Same-origin only: a 404 in a frame
 * would otherwise look like a broken call view.
 */
const useHarnessPresent = (page: string): boolean | null => {
	const [present, setPresent] = React.useState<boolean | null>(null);
	React.useEffect(() => {
		if (/^https?:/.test(configuredBase)) {
			setPresent(true);
			return;
		}
		let live = true;
		fetch(`${configuredBase}/harness/${page}.html`)
			.then(async (res) =>
				res.ok ? (await res.text()).includes('visual proof') : false
			)
			.catch(() => false)
			.then((ok) => live && setPresent(ok));
		return () => {
			live = false;
		};
	}, [page]);
	return present;
};

const CallView: React.FC<CallViewArgs> = (args) => {
	const page = args.situation === 'oneOnOne' ? 'einzelCall' : 'buehne';
	const present = useHarnessPresent(page);
	if (present === null) return null;
	if (!present) {
		return (
			<p style={{ padding: 24, maxWidth: '65ch' }}>
				The call view pages are not part of this Storybook build. CI
				adds them from ORISO-ElementCall; locally, run{' '}
				<code>yarn build:harness</code> there and copy{' '}
				<code>dist-harness</code> to{' '}
				<code>storybook-static/call-harness</code>, or set{' '}
				<code>STORYBOOK_CALL_HARNESS_URL</code>.
			</p>
		);
	}
	const frame = (
		<iframe
			// A new frame per address: the pages read their parameters once.
			key={harnessUrl(configuredBase, args)}
			title="Call view"
			src={harnessUrl(configuredBase, args)}
			style={{
				width: args.phone ? 390 : '100%',
				height: args.phone ? 844 : '100vh',
				border: 0,
				display: 'block'
			}}
		/>
	);
	return args.phone ? (
		<div
			style={{
				display: 'flex',
				justifyContent: 'center',
				padding: 16,
				background: '#2d2c28'
			}}
		>
			{frame}
		</div>
	) : (
		frame
	);
};

const meta: Meta<CallViewArgs> = {
	title: 'Call/Views',
	parameters: { layout: 'fullscreen' },
	argTypes: {
		situation: {
			control: 'inline-radio',
			options: ['group', 'oneOnOne'],
			description: 'Group stage, or the 1:1 call'
		},
		participants: {
			control: { type: 'range', min: 2, max: 18, step: 1 },
			description: 'People in the call (group stage only)',
			if: { arg: 'situation', eq: 'group' }
		},
		view: {
			control: 'inline-radio',
			options: ['kreis', 'hain', 'felder', 'kacheln'],
			description: 'Kreis, Hain, Felder, Kacheln (group stage only)',
			if: { arg: 'situation', eq: 'group' }
		},
		callType: {
			control: 'inline-radio',
			options: ['group', 'single'],
			description: 'How the call was started (group stage only)',
			if: { arg: 'situation', eq: 'group' }
		},
		media: { control: 'inline-radio', options: ['audio', 'video'] },
		speaking: {
			control: { type: 'number', min: 0, max: 17 },
			description: 'Who is speaking (0 = first person)'
		},
		notes: { control: 'boolean', description: 'Note card open' },
		phone: { control: 'boolean', description: 'Phone width (390 px)' }
	},
	args: {
		situation: 'group',
		participants: 3,
		view: 'kreis',
		media: 'audio',
		callType: 'group',
		speaking: 0,
		notes: false,
		phone: false
	},
	render: (args) => <CallView {...args} />
};
export default meta;

type Story = StoryObj<CallViewArgs>;

export const GroupStage: Story = {};

export const OneOnOne: Story = {
	args: { situation: 'oneOnOne', media: 'video' }
};

export const Phone: Story = {
	args: { participants: 3, view: 'hain', phone: true }
};
