/**
 * Story fixtures for the supervision panel family. Realistic German content,
 * fixed timestamps, and one invariant every story can assert: the client
 * (Ratsuchende:r) never appears in the side room.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SupervisionViewerRole } from './SupervisionPanel';

export const SUPERVISOR_NAME = 'Bettina Berg';
export const CONSULTANT_NAME = 'uebungs_berater_schulden_1';
/** Client pseudonym — must only ever show up in the MAIN chat fixture. */
export const CLIENT_NAME = 'Sonnenblume_47';

export const counterpartFor = (viewerRole: SupervisionViewerRole): string =>
	viewerRole === 'consultant' ? SUPERVISOR_NAME : CONSULTANT_NAME;

export interface FixtureMessage {
	id: string;
	author: string;
	body: string;
	time: string;
}

const sideRoomThread: FixtureMessage[] = [
	{
		id: '$s1',
		author: CONSULTANT_NAME,
		body: 'Die Ratsuchende hat heute zum zweiten Mal Mahnbescheide erwähnt, geht aber jedes Mal sofort auf ein anderes Thema. Wie würdest du das ansprechen?',
		time: '09:12'
	},
	{
		id: '$s2',
		author: SUPERVISOR_NAME,
		body: 'Ich würde es nicht forcieren. Benenne kurz, dass du das Thema wahrgenommen hast, und lass die Entscheidung bei ihr – Vermeidung ist hier oft Scham.',
		time: '09:15'
	},
	{
		id: '$s3',
		author: SUPERVISOR_NAME,
		body: 'Wenn es beim dritten Mal wieder kommt: Angebot für einen konkreten Termin zur Schuldenaufstellung machen, ohne Zahlen im Chat.',
		time: '09:16'
	},
	{
		id: '$s4',
		author: CONSULTANT_NAME,
		body: 'Danke, das hilft. Ich formuliere es so und melde mich nach dem nächsten Kontakt.',
		time: '09:20'
	}
];

export const sideRoomMessages = (): FixtureMessage[] => sideRoomThread;

/** The MAIN client chat — the only place the client name is allowed. */
export const mainChatMessages: FixtureMessage[] = [
	{
		id: '$m1',
		author: CLIENT_NAME,
		body: 'Hallo, ich weiß nicht so recht, wo ich anfangen soll. Es ist gerade alles ein bisschen viel.',
		time: '08:58'
	},
	{
		id: '$m2',
		author: CONSULTANT_NAME,
		body: 'Schön, dass Sie sich gemeldet haben. Fangen Sie einfach dort an, wo es Ihnen gerade am meisten auf der Seele liegt.',
		time: '09:02'
	},
	{
		id: '$m3',
		author: CLIENT_NAME,
		body: 'Es sind ein paar Briefe gekommen, die ich nicht aufgemacht habe. Aber eigentlich geht es mir eher um meinen Job.',
		time: '09:07'
	}
];

export const lastSideRoomSnippet = (): string =>
	sideRoomThread[sideRoomThread.length - 1].body;

/* ------------------------------------------------------------------ *
 * Lightweight bubbles + composer used by the stories only
 * ------------------------------------------------------------------ */

export const FixtureBubbles = ({
	messages,
	viewerName
}: {
	messages: FixtureMessage[];
	viewerName: string;
}) => (
	<>
		{messages.map((message) => {
			const own = message.author === viewerName;
			return (
				<article
					key={message.id}
					className={`supervisionBubble${own ? ' supervisionBubble--own' : ''}`}
					data-cy="supervision-bubble"
					data-own={own ? 'true' : 'false'}
				>
					<span className="supervisionBubble__meta">
						<span className="supervisionBubble__author">
							{message.author}
						</span>
						<span>{message.time}</span>
					</span>
					<span className="supervisionBubble__body">
						{message.body}
					</span>
				</article>
			);
		})}
	</>
);

export const FixtureComposer = ({
	counterpartName,
	onSend
}: {
	counterpartName: string;
	onSend?: (text: string) => void;
}) => {
	const { t: translate } = useTranslation();
	const [draft, setDraft] = useState('');
	const submit = () => {
		if (!draft.trim()) {
			return;
		}
		onSend?.(draft.trim());
		setDraft('');
	};
	return (
		<div className="supervisionComposer">
			<textarea
				className="supervisionComposer__input"
				aria-label={translate(
					'supervision.panel.composer.placeholder',
					{
						name: counterpartName
					}
				)}
				placeholder={translate(
					'supervision.panel.composer.placeholder',
					{
						name: counterpartName
					}
				)}
				value={draft}
				rows={1}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						submit();
					}
				}}
				data-cy="supervision-composer-input"
			/>
			<button
				type="button"
				className="supervisionComposer__send"
				onClick={submit}
				disabled={!draft.trim()}
				data-cy="supervision-composer-send"
			>
				{translate('supervision.panel.composer.send')}
			</button>
		</div>
	);
};

/** Stand-in for the client chat card in SplitStage stories. */
export const FixtureMainChat = () => (
	<div
		data-cy="fixture-main-chat"
		style={{
			display: 'flex',
			flexDirection: 'column',
			gap: 8,
			height: '100%',
			padding: 16,
			boxSizing: 'border-box',
			background: 'var(--m3-surface-container-lowest, #ffffff)',
			borderRadius: 16,
			margin: 12,
			border: '1px solid var(--m3-outline-variant, #c4c7c8)',
			overflow: 'auto'
		}}
	>
		<h2
			style={{
				margin: '0 0 8px',
				fontSize: 15,
				fontWeight: 600,
				color: 'var(--m3-on-surface, #1b1b1c)'
			}}
		>
			{CLIENT_NAME}
		</h2>
		<FixtureBubbles
			messages={mainChatMessages}
			viewerName={CONSULTANT_NAME}
		/>
	</div>
);
