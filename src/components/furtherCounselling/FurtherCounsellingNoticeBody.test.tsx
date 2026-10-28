// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { FurtherCounsellingNoticeBody } from './FurtherCounsellingNoticeBody';
import {
	FURTHER_COUNSELLING_RECOMMENDED,
	TOPIC_DUPLICATE_ENDED,
	TOPIC_DUPLICATE_STARTED
} from './furtherCounsellingNotices';
import { TopicsContext } from '../../globalState/provider/TopicsProvider';

const dialogProps = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.topic ? `${key}[${options.topic}]` : key,
		i18n: { language: 'de' }
	})
}));

vi.mock('./useFurtherCounsellingPrefill', () => ({
	useFurtherCounsellingPrefill: () => ({
		prefilledPostcode: '10115',
		knownAgencyIds: [42]
	})
}));

vi.mock('../profile/NewRequestDialog/NewRequestDialog', () => ({
	NewRequestDialog: (props: any) => {
		dialogProps(props);
		return (
			<div data-testid="new-request-dialog">
				<button
					type="button"
					onClick={() => props.onRequestCreated(77)}
				>
					created
				</button>
			</div>
		);
	}
}));

const recommendation = (note: string | null = null) => ({
	type: FURTHER_COUNSELLING_RECOMMENDED as typeof FURTHER_COUNSELLING_RECOMMENDED,
	topicId: 7,
	note,
	recommendedBy: null,
	createdAt: null
});

const renderBody = (
	notice: React.ComponentProps<typeof FurtherCounsellingNoticeBody>['notice'],
	viewerIsAsker: boolean,
	messageId = 'msg-1'
) =>
	render(
		<TopicsContext.Provider
			value={{
				topics: [{ id: 7, name: 'Schulden' } as any],
				refreshTopics: () => {}
			}}
		>
			<FurtherCounsellingNoticeBody
				notice={notice}
				viewerIsAsker={viewerIsAsker}
				messageId={messageId}
			/>
		</TopicsContext.Provider>
	);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('FurtherCounsellingNoticeBody', () => {
	it('shows topic and default text with the find button for the asker', () => {
		renderBody(recommendation(), true);
		expect(
			screen.getByText('furtherCounselling.card.topic[Schulden]')
		).toBeTruthy();
		expect(
			screen.getByText('furtherCounselling.card.defaultText')
		).toBeTruthy();
		expect(
			screen.getByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		).toBeTruthy();
	});

	it('shows the same card without the button to the counsellor', () => {
		renderBody(recommendation('Bitte dort melden'), false);
		expect(
			screen.getByText('furtherCounselling.card.defaultText')
		).toBeTruthy();
		expect(screen.getByText('Bitte dort melden')).toBeTruthy();
		expect(
			screen.queryByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		).toBeNull();
	});

	it('renders the note as text, never as markup', () => {
		renderBody(recommendation('<img src=x onerror=alert(1)>'), true);
		expect(document.querySelector('img')).toBeNull();
		expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
	});

	it('opens the request dialog with the recommended topic and the prefill', () => {
		renderBody(recommendation(), true);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		);
		expect(dialogProps).toHaveBeenCalledWith(
			expect.objectContaining({
				open: true,
				preselectedTopicId: 7,
				prefilledPostcode: '10115',
				knownAgencyIds: [42]
			})
		);
	});

	it('says "Anfrage gestellt" after a request and keeps the button', () => {
		renderBody(recommendation(), true);
		expect(
			screen.queryByText('furtherCounselling.card.requested')
		).toBeNull();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		);
		fireEvent.click(screen.getByText('created'));
		expect(
			screen.getByText('furtherCounselling.card.requested')
		).toBeTruthy();
		expect(
			screen.getByRole('button', {
				name: 'furtherCounselling.card.findAgency'
			})
		).toBeTruthy();

		cleanup();
		renderBody(recommendation(), true);
		expect(
			screen.getByText('furtherCounselling.card.requested')
		).toBeTruthy();
		cleanup();
		renderBody(recommendation(), true, 'msg-2');
		expect(
			screen.queryByText('furtherCounselling.card.requested')
		).toBeNull();
	});

	it('falls back gracefully when the topic is unknown', () => {
		renderBody({ ...recommendation(), topicId: 999 }, true);
		expect(
			screen.getByText(
				'furtherCounselling.card.topic[furtherCounselling.card.topicUnknown]'
			)
		).toBeTruthy();
	});

	it('renders both duplicate notices as plain text for everyone', () => {
		renderBody(
			{ type: TOPIC_DUPLICATE_STARTED, topicId: 7, newSessionId: 3 },
			false
		);
		expect(
			screen.getByText('furtherCounselling.duplicate.started[Schulden]')
		).toBeTruthy();
		cleanup();
		renderBody({ type: TOPIC_DUPLICATE_ENDED, topicId: 7 }, true);
		expect(
			screen.getByText('furtherCounselling.duplicate.ended[Schulden]')
		).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});
});
