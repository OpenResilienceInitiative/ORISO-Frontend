import * as React from 'react';
import { useEffect } from 'react';
import '../sessionsList/sessionsList.styles.scss';
import '../sessionsListItem/sessionsListItem.styles.scss';
import '../message/message.styles.scss';
import './themeDemo.styles.scss';

/**
 * Auth-free theme demo (Frontend#144): the admin's Theme Builder embeds
 * this page in its sandboxed iframe preview. It renders the REAL app
 * markup — the production stylesheets and class names of the session
 * list and the chat room — filled with fictional counselling content.
 *
 * Deliberately free of logins, sessions and API calls: the page shows
 * nothing that is not already public in this repository. The colours
 * come from the tenant palette or, inside the preview, from the
 * strictly-validated themePreview* query params (applied globally by
 * useTenantTheming).
 */

interface DemoSession {
	topic: string;
	caseId?: string;
	username: string;
	subject: string;
	active?: boolean;
	avatar: string;
}

const DEMO_SESSIONS: DemoSession[] = [
	{
		topic: 'Familienberatung',
		caseId: '12345',
		username: 'ruhiges Yak Kim',
		subject: 'Anfrage gesendet',
		active: true,
		avatar: '🐃'
	},
	{
		topic: 'Suchtberatung',
		caseId: '99322',
		username: 'Ratsuchender_R3',
		subject: 'Ja das ist schön, dass Sie das…',
		avatar: '🐂'
	},
	{
		topic: 'Familienberatung',
		username: 'sanftes Alpaka Alin',
		subject: 'Vielen Dank für das Gespräch!',
		avatar: '🦙'
	}
];

interface DemoMessage {
	own?: boolean;
	username: string;
	avatar?: string;
	text: string;
}

const DEMO_MESSAGES: DemoMessage[] = [
	{
		username: 'ruhiges Yak Kim',
		avatar: '🐃',
		text: 'Guten Tag, ich habe eine Frage zu meinem nächsten Termin.'
	},
	{
		own: true,
		username: 'A. Kräger',
		text: 'Gerne — lassen Sie uns das morgen früh gemeinsam anschauen.'
	},
	{
		username: 'ruhiges Yak Kim',
		avatar: '🐃',
		text: 'Das passt gut, vielen Dank!'
	}
];

const DemoSessionCard = ({ session }: { session: DemoSession }) => (
	<div
		className={`sessionsListItem${
			session.active ? ' sessionsListItem--active' : ''
		}`}
	>
		<div className="sessionsListItem__content">
			<div className="sessionsListItem__row">
				<div className="sessionsListItem__rowLeft">
					<div className="sessionsListItem__topicPostcodeGroup">
						<div className="sessionsListItem__topic">
							{session.topic}
						</div>
						{session.caseId && (
							<div className="sessionsListItem__postcode">
								{session.caseId}
							</div>
						)}
					</div>
				</div>
				<div className="sessionsListItem__rowRight">
					<div className="sessionsListItem__date">jetzt</div>
				</div>
			</div>
			<div className="sessionsListItem__row">
				<div className="sessionsListItem__icon" aria-hidden>
					<span className="themeDemo__avatar">{session.avatar}</span>
				</div>
				<div className="sessionsListItem__username">
					{session.username}
				</div>
			</div>
			<div className="sessionsListItem__row">
				<div className="sessionsListItem__subject">
					{session.subject}
				</div>
			</div>
		</div>
	</div>
);

const DemoMessageItem = ({ message }: { message: DemoMessage }) => (
	<div className={`messageItem${message.own ? ' messageItem--right' : ''}`}>
		<div className="messageItem__username">
			{message.avatar && (
				<span className="themeDemo__avatar" aria-hidden>
					{message.avatar}
				</span>
			)}
			{message.username}
		</div>
		<div
			className={`messageItem__message${
				message.own ? ' messageItem__message--myMessage' : ''
			}`}
		>
			{message.text}
		</div>
	</div>
);

export const ThemeDemo = () => {
	useEffect(() => {
		// Demo content only — keep it out of search indexes.
		const meta = document.createElement('meta');
		meta.setAttribute('name', 'robots');
		meta.setAttribute('content', 'noindex');
		document.head.appendChild(meta);
		return () => {
			document.head.removeChild(meta);
		};
	}, []);

	return (
		<div className="themeDemo">
			<aside className="themeDemo__list">
				<div className="themeDemo__listHeader">Gespräche</div>
				{DEMO_SESSIONS.map((session) => (
					<DemoSessionCard key={session.username} session={session} />
				))}
			</aside>
			<main className="themeDemo__chat session">
				<header className="themeDemo__chatHeader">
					<span className="themeDemo__chatTopic">
						Familienberatung 12345
					</span>
					<span className="themeDemo__chatName">ruhiges Yak Kim</span>
				</header>
				<div className="themeDemo__messages">
					<div className="messageItem__divider">Heute</div>
					{DEMO_MESSAGES.map((message) => (
						<DemoMessageItem key={message.text} message={message} />
					))}
				</div>
				<footer className="themeDemo__editor">
					<div className="textarea themeDemo__textarea">
						<span className="themeDemo__placeholder">
							Nachricht an Klient:in schreiben
						</span>
						<button
							type="button"
							className="themeDemo__send"
							aria-label="Senden"
							disabled
						>
							➤
						</button>
					</div>
				</footer>
			</main>
		</div>
	);
};
