// @vitest-environment oriso-jsdom
/**
 * FE#1435 — the in-app pop-up for a new enquiry: what it says, where its
 * button leads, how several enquiries share one card, and when it goes away.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	cleanup,
	configure,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import {
	ENQUIRY_LIST_PATH,
	isEnquiryListOpen,
	isNewEnquiryForCounsellor,
	NEW_ENQUIRY_NOTICE_ID,
	NewEnquiryNotice,
	NewEnquiryNoticeProps,
	NOTIFICATION_TYPE_NEW_ENQUIRY,
	upsertNewEnquiryNotice
} from './NewEnquiryNotice';

configure({ testIdAttribute: 'data-cy' });

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) =>
			opts ? `${key}:${JSON.stringify(opts)}` : key
	})
}));
vi.mock(
	'../../resources/img/icons/navigation/counsellor_request_400.svg',
	() => ({
		ReactComponent: () => null
	})
);
vi.mock('../../resources/img/icons/close.svg', () => ({
	ReactComponent: () => null
}));

const PREVIEW = '/sessions/consultant/sessionPreview/!room246/246';

const notice = (
	overrides: Partial<NewEnquiryNoticeProps> = {}
): NewEnquiryNoticeProps => ({
	id: NEW_ENQUIRY_NOTICE_ID,
	notificationType: NOTIFICATION_TYPE_NEW_ENQUIRY,
	count: 1,
	path: PREVIEW,
	...overrides
});

const Where = () => <div data-cy="where">{useLocation().pathname}</div>;
const GoTo = ({ to }: { to: string }) => {
	const navigate = useNavigate();
	return <button onClick={() => navigate(to)}>go</button>;
};

const renderNotice = (
	props: NewEnquiryNoticeProps,
	goTo = ENQUIRY_LIST_PATH
) => {
	const removeNotification = vi.fn();
	render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<NotificationsContext.Provider
				value={{ removeNotification } as never}
			>
				<NewEnquiryNotice {...props} />
				<Where />
				<GoTo to={goTo} />
			</NotificationsContext.Provider>
		</MemoryRouter>
	);
	return removeNotification;
};

describe('NewEnquiryNotice', () => {
	afterEach(cleanup);

	it('announces one enquiry and opens it', () => {
		const remove = renderNotice(notice());

		expect(screen.getByRole('status')).toBeTruthy();
		expect(screen.getByText('notification.newEnquiry.title')).toBeTruthy();
		expect(
			screen.getByText('notification.newEnquiry.waiting')
		).toBeTruthy();
		fireEvent.click(screen.getByText('notification.newEnquiry.openOne'));

		expect(screen.getByTestId('where').textContent).toBe(PREVIEW);
		expect(remove).toHaveBeenCalledWith(
			NEW_ENQUIRY_NOTICE_ID,
			NOTIFICATION_TYPE_NEW_ENQUIRY
		);
	});

	it('counts several enquiries on the same card and opens the list', () => {
		renderNotice(notice({ count: 3, path: ENQUIRY_LIST_PATH }));

		expect(
			screen.getByText('notification.newEnquiry.several:{"count":3}')
		).toBeTruthy();
		fireEvent.click(screen.getByText('notification.newEnquiry.openList'));
		expect(screen.getByTestId('where').textContent).toBe(ENQUIRY_LIST_PATH);
	});

	it('closes by its close button', () => {
		const remove = renderNotice(notice());
		fireEvent.click(screen.getByLabelText('app.close'));
		expect(remove).toHaveBeenCalledTimes(1);
	});

	it('goes away when the counsellor opens Anfragen any other way', () => {
		const remove = renderNotice(notice());
		expect(remove).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('go'));
		expect(remove).toHaveBeenCalledWith(
			NEW_ENQUIRY_NOTICE_ID,
			NOTIFICATION_TYPE_NEW_ENQUIRY
		);
	});
});

describe('new-enquiry helpers', () => {
	it('recognises a new enquiry addressed to a counsellor', () => {
		const base = {
			sourceSessionId: '246',
			actionPath: PREVIEW
		};
		expect(
			isNewEnquiryForCounsellor({ ...base, eventType: 'request.new' })
		).toBe(true);
		expect(
			isNewEnquiryForCounsellor({
				...base,
				eventType: 'waiting_room.client.joined'
			})
		).toBe(true);
		expect(
			isNewEnquiryForCounsellor({ ...base, eventType: 'request.denied' })
		).toBe(false);
		// Only counsellor links: an asker never gets an enquiry pop-up.
		expect(
			isNewEnquiryForCounsellor({
				eventType: 'request.new',
				actionPath: '/sessions/user/view/!room/1'
			})
		).toBe(false);
	});

	it('knows when the Anfragen list is on screen', () => {
		expect(isEnquiryListOpen(ENQUIRY_LIST_PATH, true)).toBe(true);
		expect(isEnquiryListOpen(PREVIEW, true)).toBe(true);
		expect(isEnquiryListOpen(ENQUIRY_LIST_PATH, false)).toBe(false);
		expect(
			isEnquiryListOpen('/sessions/consultant/sessionView', true)
		).toBe(false);
	});

	it('adds the card once and counts on it, linking to the list from the second enquiry', () => {
		const first = upsertNewEnquiryNotice([], notice());
		expect(first).toHaveLength(1);
		const second = upsertNewEnquiryNotice(
			first,
			notice({ path: '/sessions/consultant/sessionPreview/!r2/2' })
		);
		expect(second).toHaveLength(1);
		expect(second[0]).toMatchObject({ count: 2, path: ENQUIRY_LIST_PATH });
	});
});
