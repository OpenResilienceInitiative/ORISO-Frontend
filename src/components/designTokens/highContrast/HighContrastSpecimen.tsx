/**
 * One column of the high-contrast comparison (Frontend#1134): the real
 * chat bubble, button, session row and input components, rendered inside a
 * wrapper that carries one candidate's token map as CSS custom properties.
 *
 * Every component reads its colours through `var(--m3-*)` /
 * `var(--oriso-*)`, so scoping the map to a wrapper is enough to preview a
 * palette without touching the document root, the default theme or any
 * setting. Anything that does NOT change between columns is a colour the
 * component hard-codes — that is a finding, listed in the story docs.
 *
 * Storybook only. Nothing in the app imports this.
 */
import * as React from 'react';
import { OrisoTextField } from '../../form/OrisoTextField';
import { Button, BUTTON_TYPES } from '../../button/Button';
import { MessageItemComponent } from '../../message/MessageItemComponent';
import {
	ActiveSessionContext,
	buildExtendedSession,
	ConsultingTypesContext,
	E2EEContext,
	SessionTypeContext,
	SessionsDataContext,
	TopicsContext,
	UserDataContext,
	AUTHORITIES
} from '../../../globalState';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE,
	type ConsultingTypeInterface,
	type ListItemInterface,
	type TopicsDataInterface
} from '../../../globalState/interfaces';
import { ConsultantListContext } from '../../../globalState/provider/ConsultantListProvider';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { ServerSettingsContext } from '../../../globalState/provider/ServerSettingsProvider';
import { SESSION_LIST_TYPES } from '../../session/sessionHelpers';
import { SessionListItemComponent } from '../../sessionsListItem/SessionListItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	MOCK_CONSULTANT_MATRIX_ID,
	mockActiveSession1on1,
	mockConsultantListContext,
	mockE2EEContext,
	mockE2eeParams,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockUserData
} from '../../message/MessageItemComponent.mocks';
import '../../message/message.styles.scss';
import '../../sessionsListItem/sessionsListItem.styles.scss';
import './highContrast.styles.scss';

const topic: TopicsDataInterface = {
	id: 1,
	name: 'Familienberatung',
	slug: 'familienberatung',
	description: 'Beratung bei Fragen zu Familie und Erziehung.',
	internalIdentifier: 'familienberatung',
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: 'Familienberatung',
		long: 'Familienberatung',
		registrationDropdown: 'Familienberatung',
		welcome: 'Familienberatung'
	}
};

const consultingType: ConsultingTypeInterface = {
	id: 1,
	showAskerProfile: true,
	titles: {
		default: '1-1 Beratung',
		short: '1-1',
		long: '1-1 Beratung',
		welcome: 'Willkommen',
		registrationDropdown: '1-1 Beratung'
	},
	isVideoCallAllowed: true,
	isSubsequentRegistrationAllowed: true,
	urls: {
		registrationPostcodeFallbackUrl: '',
		requiredAidMissingRedirectUrl: ''
	},
	registration: {
		autoSelectAgency: false,
		autoSelectPostcode: false,
		notes: {}
	},
	groupChat: { isGroupChat: false, groupChatRules: [''] },
	description: 'Storybook fixture.',
	slug: 'one-on-one',
	languageFormal: true,
	welcomeScreen: { anonymous: { title: 'Willkommen', text: '' } }
};

const sessionRow: ListItemInterface = {
	user: {
		username: 'ruhiges-yak-kim@example.invalid',
		displayName: 'ruhiges Yak Kim',
		sessionData: {}
	},
	consultant: {
		consultantId: 'consultant-storybook',
		id: 'consultant-storybook',
		username: 'beraterin@example.invalid',
		displayName: 'Beraterin ORISO',
		absent: false,
		absenceMessage: ''
	},
	language: 'de',
	session: {
		id: 4401,
		agencyId: 101,
		askerMatrixUserId: 'asker-4401',
		attachment: null,
		consultingType: 1,
		matrixRoomId: 'storybook-high-contrast-4401',
		e2eLastMessage: null,
		lastMessage: 'Danke, das hilft mir weiter.',
		messageDate: 1773822900,
		createDate: '2026-03-18T06:15:00.000Z',
		messagesRead: true,
		postcode: 12345,
		registrationType: REGISTRATION_TYPE_REGISTERED,
		status: STATUS_ACTIVE,
		videoCallMessageDTO: null,
		topic
	}
};

const consultantUser = {
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

const handlers = {
	handleDecryptionErrors: () => {},
	handleDecryptionSuccess: () => {},
	e2eeParams: mockE2eeParams()
};

const SessionRow: React.FC = () => {
	const activeSession = buildExtendedSession(sessionRow, '');
	return (
		<UserDataContext.Provider
			value={{
				userData: consultantUser,
				setUserData: () => {},
				reloadUserData: async () => consultantUser
			}}
		>
			<SessionTypeContext.Provider
				value={{
					type: SESSION_LIST_TYPES.MY_SESSION,
					path: '/sessions/consultant/sessionView'
				}}
			>
				<ConsultingTypesContext.Provider
					value={{
						consultingTypes: [consultingType],
						setConsultingTypes: () => {}
					}}
				>
					<TopicsContext.Provider
						value={{ topics: [topic], refreshTopics: () => {} }}
					>
						<SessionsDataContext.Provider
							value={{
								ready: true,
								sessions: [sessionRow],
								dispatch: () => {}
							}}
						>
							<E2EEContext.Provider
								value={{
									key: '',
									reloadPrivateKey: () => {},
									isE2eeEnabled: false,
									e2EEReady: true
								}}
							>
								<LegalLinksContext.Provider value={[]}>
									<ActiveSessionContext.Provider
										value={{
											activeSession,
											reloadActiveSession: () => {},
											readActiveSession: () => {}
										}}
									>
										<SessionListItemComponent
											defaultLanguage="de"
											handleKeyDownLisItemContent={() => {}}
											index={0}
											isBeforeActive={false}
											isAfterActive={false}
										/>
									</ActiveSessionContext.Provider>
								</LegalLinksContext.Provider>
							</E2EEContext.Provider>
						</SessionsDataContext.Provider>
					</TopicsContext.Provider>
				</ConsultingTypesContext.Provider>
			</SessionTypeContext.Provider>
		</UserDataContext.Provider>
	);
};

const ChatMessages: React.FC = () => (
	<ServerSettingsContext.Provider value={mockServerSettingsContext()}>
		<ConsultantListContext.Provider value={mockConsultantListContext()}>
			<E2EEContext.Provider value={mockE2EEContext()}>
				<UserDataContext.Provider
					value={{
						userData: mockUserData(),
						setUserData: () => {},
						reloadUserData: async () => null as any
					}}
				>
					<ActiveSessionContext.Provider
						value={{
							activeSession: mockActiveSession1on1(),
							reloadActiveSession: () => {},
							readActiveSession: () => {}
						}}
					>
						<MessageItemComponent
							{...mockMessageItemComponentProps({
								isMyMessage: false,
								userId: MOCK_ASKER_MATRIX_ID,
								askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
								displayName: 'Sanftes Alpaka Kala',
								username: 'sanftes.alpaka.kala@oriso.invalid',
								message:
									'Ich habe heute wieder starkes Verlangen. Gibt es dazu eine Seite, die ich lesen kann?'
							})}
							{...handlers}
						/>
						<MessageItemComponent
							{...mockMessageItemComponentProps({
								isMyMessage: true,
								userId: MOCK_CONSULTANT_MATRIX_ID,
								displayName: 'Karina P',
								username: 'karina.p@oriso.invalid',
								isNotRead: true,
								message:
									'Ja, schauen Sie bitte hier: https://www.example.org/hilfe-und-beratung. Danach sprechen wir darüber.'
							})}
							onReact={() => {}}
							{...handlers}
						/>
						<MessageItemComponent
							{...mockMessageItemComponentProps({
								isMyMessage: true,
								userId: MOCK_CONSULTANT_MATRIX_ID,
								displayName: 'Karina P',
								username: 'karina.p@oriso.invalid',
								isNotRead: false,
								message:
									'Diese Nachricht wurde bereits gelesen.'
							})}
							onReact={() => {}}
							{...handlers}
						/>
						<MessageItemComponent
							{...mockMessageItemComponentProps({
								isMyMessage: true,
								userId: MOCK_CONSULTANT_MATRIX_ID,
								displayName: 'Karina P',
								username: 'karina.p@oriso.invalid',
								isNotRead: true,
								message:
									'Diese Nachricht hat den Server nicht erreicht.'
							})}
							sendFailed
							onReact={() => {}}
							{...handlers}
						/>
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</E2EEContext.Provider>
		</ConsultantListContext.Provider>
	</ServerSettingsContext.Provider>
);

export interface HighContrastSpecimenProps {
	/** Candidate (or standard) token map, `--name` → value. */
	tokens: Record<string, string>;
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
	children
}) => <p className="hcSpecimen__label">{children}</p>;

export const HighContrastSpecimen: React.FC<HighContrastSpecimenProps> = ({
	tokens
}) => (
	<div
		className="hcSpecimen"
		style={tokens as React.CSSProperties}
		data-testid="hc-specimen"
	>
		<SectionLabel>Chat</SectionLabel>
		<div className="hcSpecimen__chat">
			<ChatMessages />
		</div>

		<SectionLabel>Buttons und Fokus</SectionLabel>
		<div className="hcSpecimen__buttons">
			<Button
				item={{ label: 'Termin buchen', type: BUTTON_TYPES.PRIMARY }}
				buttonHandle={() => {}}
			/>
			<Button
				item={{ label: 'Abbrechen', type: BUTTON_TYPES.SECONDARY }}
				buttonHandle={() => {}}
			/>
			<Button
				item={{
					label: 'Senden',
					type: BUTTON_TYPES.PRIMARY,
					disabled: true
				}}
				disabled
				buttonHandle={() => {}}
			/>
		</div>
		<div className="hcSpecimen__focusRow">
			<span className="hcSpecimen__ring hcSpecimen__ring--token">
				Fokus: <code>--m3-primary-outline</code>
			</span>
			<span className="hcSpecimen__ring hcSpecimen__ring--button">
				Fokus heute am Button: <code>#199fff</code>
			</span>
		</div>

		<SectionLabel>Sitzungsliste</SectionLabel>
		<div className="hcSpecimen__list" role="tablist">
			<SessionRow />
		</div>

		<SectionLabel>Eingabefeld</SectionLabel>
		<div className="hcSpecimen__inputs">
			<OrisoTextField
				label="Ihre Nachricht"
				defaultValue="Hallo, ich brauche Hilfe."
				fullWidth
			/>
			<OrisoTextField label="E-Mail-Adresse" focused fullWidth />
		</div>
	</div>
);
