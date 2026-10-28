import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { CaseHandoverSystemMessageCard } from '../caseHandover/CaseHandoverClientCards';
import {
	MessageStoryShell,
	phone390Globals
} from '../message/messageStoryShell';
import { TopicsContext } from '../../globalState/provider/TopicsProvider';
import { FurtherCounsellingNoticeBody } from './FurtherCounsellingNoticeBody';
import {
	FURTHER_COUNSELLING_RECOMMENDED,
	FurtherCounsellingNotice,
	TOPIC_DUPLICATE_ENDED,
	TOPIC_DUPLICATE_STARTED
} from './furtherCounsellingNotices';
import { markRequestedFromCard } from './furtherCounsellingCardState';
import '../message/message.styles.scss';

const topics = [
	{ id: 7, name: 'Schulden', slug: 'debt' },
	{ id: 9, name: 'Familie', slug: 'family' }
] as any[];

const NOTE =
	'Nach Ihrem Umzug ist eine Schuldnerberatung in Ihrer Nähe sinnvoll. Dort kann man Sie auch vor Ort unterstützen.';

const titleKey = (notice: FurtherCounsellingNotice) =>
	notice.type === FURTHER_COUNSELLING_RECOMMENDED
		? 'furtherCounselling.card.title'
		: notice.type === TOPIC_DUPLICATE_STARTED
			? 'furtherCounselling.duplicate.startedTitle'
			: 'furtherCounselling.duplicate.endedTitle';

interface NoticeArgs {
	notice: FurtherCounsellingNotice;
	viewerIsAsker: boolean;
	messageId: string;
	compact?: boolean;
}

/** The notice the way the message list draws it: Carimat header, grey bubble. */
const NoticeInStream = ({
	notice,
	viewerIsAsker,
	messageId,
	compact
}: NoticeArgs) => {
	const { t } = useTranslation();
	return (
		<TopicsContext.Provider value={{ topics, refreshTopics: () => {} }}>
			<MessageStoryShell compact={compact}>
				<CaseHandoverSystemMessageCard
					title={t('message.systemNotificationTitle')}
					subtitle={t('message.systemNotification')}
					topic={t(titleKey(notice))}
					timestamp="09:15"
				>
					<FurtherCounsellingNoticeBody
						notice={notice}
						viewerIsAsker={viewerIsAsker}
						messageId={messageId}
					/>
				</CaseHandoverSystemMessageCard>
			</MessageStoryShell>
		</TopicsContext.Provider>
	);
};

const recommendation = (note: string | null): FurtherCounsellingNotice => ({
	type: FURTHER_COUNSELLING_RECOMMENDED,
	topicId: 7,
	note,
	recommendedBy: 'Karina P',
	createdAt: '2026-10-28T09:15:00Z'
});

const clearRequested = (messageId: string) => {
	try {
		window.localStorage.removeItem(
			`oriso.furtherCounselling.requested.${messageId}`
		);
	} catch {
		/* storage blocked in this preview */
	}
};

const meta = {
	title: 'Chat/System messages/Further counselling',
	component: NoticeInStream,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: [
					'FE#1876. A counsellor recommends further counselling from the session menu; the room shows this card.',
					'',
					'Only the advice seeker gets **Beratungsstelle finden**, which opens the request dialog with the topic preselected and the postcode per the platform setting. Afterwards the card says **Anfrage gestellt** and stays usable. The card is drawn only for a counsellor-sent event.',
					'',
					'The two same-topic notices are plain text for everyone. The chat notices stay formal in both German variants.'
				].join('\n')
			}
		}
	},
	args: {
		notice: recommendation(NOTE),
		viewerIsAsker: true,
		messageId: 'story-recommendation-asker'
	},
	beforeEach: ({ args }) => clearRequested(args.messageId)
} satisfies Meta<NoticeArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const findButton = (canvasElement: HTMLElement) =>
	within(canvasElement).queryByRole('button', {
		name: /Beratungsstelle finden|Find a counselling centre/
	});

export const AskerWithNote: Story = {
	name: 'Asker — with note',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText(/Schulden/)).toBeVisible();
		await expect(canvas.getByText(NOTE)).toBeVisible();
		await expect(findButton(canvasElement)).toBeVisible();
	}
};

export const AskerWithoutNote: Story = {
	name: 'Asker — without note',
	args: {
		notice: recommendation(null),
		messageId: 'story-recommendation-asker-plain'
	},
	play: async ({ canvasElement }) => {
		await expect(findButton(canvasElement)).toBeVisible();
		await expect(within(canvasElement).queryByText(NOTE)).toBeNull();
	}
};

export const AskerPhone390: Story = {
	tags: ['device-regression'],
	name: 'Asker — phone 390',
	globals: phone390Globals,
	args: { compact: true, messageId: 'story-recommendation-phone' }
};

export const CounsellorWithNote: Story = {
	name: 'Counsellor — with note',
	args: {
		viewerIsAsker: false,
		messageId: 'story-recommendation-counsellor'
	},
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByText(NOTE)
		).toBeVisible();
		await expect(findButton(canvasElement)).toBeNull();
	}
};

export const CounsellorWithoutNote: Story = {
	name: 'Counsellor — without note',
	args: {
		viewerIsAsker: false,
		notice: recommendation(null),
		messageId: 'story-recommendation-counsellor-plain'
	},
	play: async ({ canvasElement }) => {
		await expect(findButton(canvasElement)).toBeNull();
	}
};

export const AskerRequestSent: Story = {
	name: 'Asker — request sent (used)',
	args: { messageId: 'story-recommendation-used' },
	beforeEach: ({ args }) => {
		markRequestedFromCard(args.messageId);
		return () => clearRequested(args.messageId);
	},
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByRole('status')
		).toBeVisible();
		// Stays usable for a further topic.
		await expect(findButton(canvasElement)).toBeEnabled();
	}
};

export const DuplicateStarted: Story = {
	name: 'Same topic — further counselling started',
	args: {
		viewerIsAsker: false,
		notice: { type: TOPIC_DUPLICATE_STARTED, topicId: 7, newSessionId: 99 },
		messageId: 'story-duplicate-started'
	},
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByText(/Schulden/)
		).toBeVisible();
		await expect(
			within(canvasElement).queryByRole('button', {
				name: /Beratungsstelle/
			})
		).toBeNull();
	}
};

export const DuplicateEnded: Story = {
	name: 'Same topic — second counselling ended',
	args: {
		notice: { type: TOPIC_DUPLICATE_ENDED, topicId: 7 },
		messageId: 'story-duplicate-ended'
	},
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByText(/Schulden/)
		).toBeVisible();
	}
};
