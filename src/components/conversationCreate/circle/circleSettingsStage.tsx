import * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationBar } from '../../app/NavigationBar';
import { RouterConfigConsultant } from '../../app/RouterConfig';
import {
	NavigationStoryProviders,
	storybookSettings
} from '../../app/navigationStoryHelpers';
import { config } from '../../../resources/scripts/config';
import { SessionsDataProvider } from '../../../globalState/provider/SessionsDataProvider';
import { InternalChatPerson } from '../internal/InternalChatCreateCard';
import { BackPill } from '../BackPill';
import { PanelHeader } from '../PanelHeader';
import { CircleSettingsView } from './CircleSettingsView';
import '../../app/navigation.styles.scss';
import '../../app/authenticatedApp.styles.scss';
import '../conversationCreate.styles.scss';
import '../../groupChat/createChat.styles.scss';

/**
 * Storybook-only stage for the Gesprächskreis settings screen (#1499): the
 * real `CircleSettingsView` inside the consultant app frame — production
 * navigation rail / bottom bar, a session-list column and the
 * `.conversationCreate` card. The list column is a neutral stand-in with the
 * real list's width and surface; it is scenery, not under review.
 */

const TOPICS = ['Sucht', 'Schulden', 'Kinder und Jugendliche', 'Trauer'].map(
	(name) => ({ value: name, label: name })
);

export const COLLEAGUES: InternalChatPerson[] = [
	{ id: 'c-1', label: 'Sabine Leutheuser' },
	{ id: 'c-2', label: 'Karl Jung' },
	{ id: 'c-3', label: 'Charlotte Rausch' }
];

const AGENCIES = [{ value: '101', label: 'Caritas Beratungszentrum Köln' }];

export type StageProps = {
	layout: 'desktop' | 'mobile';
	people: InternalChatPerson[];
	activeLanguages: string[];
};

const Rail = ({ layout }: { layout: 'desktop' | 'mobile' }) => {
	const routerConfig = useMemo(
		() => RouterConfigConsultant({ ...config, ...storybookSettings }),
		[]
	);
	return (
		<NavigationStoryProviders role="consultant">
			<div
				className="app__wrapper circleStageRail"
				style={
					layout === 'desktop'
						? { width: 85, height: '100%', overflow: 'hidden' }
						: { width: '100%', height: 76, overflow: 'hidden' }
				}
			>
				<style>
					{`
						.circleStageRail.app__wrapper { display: flex; }
						.circleStageRail .navigation__wrapper {
							width: ${layout === 'desktop' ? '85px' : '100%'};
							height: 100%;
						}
					`}
				</style>
				<NavigationBar
					routerConfig={routerConfig}
					onLogout={() => {}}
				/>
			</div>
		</NavigationStoryProviders>
	);
};

const ListColumnStandIn = () => (
	<aside
		aria-label="Session list (stand-in)"
		style={{
			background: 'var(--m3-surface-container-lowest, #ffffff)',
			border: '1px solid var(--m3-outline-variant, #c4c7c8)',
			borderRadius: 32,
			boxSizing: 'border-box',
			display: 'flex',
			flex: '0 0 360px',
			flexDirection: 'column',
			gap: 12,
			padding: 24
		}}
	>
		{[0, 1, 2, 3, 4].map((row) => (
			<div
				key={row}
				style={{
					background: 'var(--m3-surface-container-low, #f6f3f3)',
					borderRadius: 16,
					height: 72
				}}
			/>
		))}
	</aside>
);

const CreateCard = ({ layout, people, activeLanguages }: StageProps) => {
	const { t } = useTranslation();
	const compact = layout === 'mobile';
	return (
		<SessionsDataProvider>
			<div className="conversationCreate">
				<PanelHeader
					title={t('groupChat.format.panelTitle')}
					menuLabel={t('groupChat.format.panelMenu')}
					menuDisabled
				/>
				<CircleSettingsView
					agencyOptions={AGENCIES}
					selectedAgency={101}
					onAgencyChange={() => undefined}
					activeLanguages={activeLanguages}
					translationAvailable
					prefill={{ topic: 'Sucht', modality: 'TEXT' }}
					topicOptions={TOPICS}
					people={people}
					compact={compact}
				/>
				{compact && (
					<BackPill
						label={t('groupChat.format.back')}
						onClick={() => undefined}
					/>
				)}
			</div>
		</SessionsDataProvider>
	);
};

export const CircleSettingsStage = (props: StageProps) =>
	props.layout === 'desktop' ? (
		<div
			style={{
				background: 'var(--m3-surface-container-high, #eae7e8)',
				display: 'flex',
				gap: 16,
				height: '100vh',
				minHeight: 900,
				padding: '16px 16px 16px 0',
				boxSizing: 'border-box'
			}}
		>
			<Rail layout="desktop" />
			<ListColumnStandIn />
			<main style={{ flex: '1 1 auto', minWidth: 0, overflowY: 'auto' }}>
				<CreateCard {...props} />
			</main>
		</div>
	) : (
		<div
			style={{
				background: 'var(--m3-surface-container-high, #eae7e8)',
				display: 'flex',
				flexDirection: 'column',
				height: '100vh',
				minHeight: 844
			}}
		>
			<main
				style={{
					flex: '1 1 auto',
					minHeight: 0,
					overflowY: 'auto',
					padding: 8
				}}
			>
				<CreateCard {...props} />
			</main>
			<Rail layout="mobile" />
		</div>
	);
