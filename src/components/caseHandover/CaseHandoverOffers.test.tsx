// @vitest-environment jsdom
/**
 * PLAN 2.3 — the offer inbox must not claim a case has moved while the client
 * still has to consent, and must stay invisible when there is nothing to show.
 *
 * This project has no jest-dom matchers, so the assertions read the DOM.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	CaseHandoverOfferBadge,
	CaseHandoverOffersInboxView,
	CaseHandoverOutgoingOfferView,
	isOpenCaseHandoverOffer,
	offerActionErrorMessage,
	offerAcceptanceNotice
} from './CaseHandoverOffers';
import { FETCH_ERRORS } from '../../api/fetchData';
import type { CaseHandoverOffer } from '../../api/apiCaseHandover';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

const offer: CaseHandoverOffer = {
	offerId: 7,
	sessionId: 42,
	status: 'PENDING_RECIPIENT_ACCEPT',
	direction: 'PUSH',
	reasonCode: 'PLANNED_ABSENCE',
	reasonLabel: 'Planned absence',
	explanation: 'Urlaubsvertretung',
	clientConsentRequired: false,
	fromConsultantId: 'c-1',
	fromConsultantName: 'Bettina Sommer',
	targetConsultantId: 'c-9',
	targetConsultantName: 'Kim Grothe',
	createdAt: '2026-09-05T10:00:00Z',
	offerExpiresAt: '2026-09-08T10:00:00Z'
};

const button = (testId: string) =>
	screen.getByTestId(testId) as HTMLButtonElement;

const renderInbox = (
	overrides: Partial<
		React.ComponentProps<typeof CaseHandoverOffersInboxView>
	> = {}
) => {
	const props = {
		offers: [offer],
		expanded: true,
		onToggle: vi.fn(),
		onAccept: vi.fn(),
		onDecline: vi.fn(),
		...overrides
	};
	render(<CaseHandoverOffersInboxView {...props} />);
	return props;
};

afterEach(cleanup);

describe('CaseHandoverOffersInboxView', () => {
	it('prints the expiry from offerExpiresAt, the field the contract sends', () => {
		renderInbox({ formatDate: (isoDate: string) => isoDate.slice(0, 10) });
		expect(
			screen.getByText('caseHandover.offers.incoming.expires')
		).toBeTruthy();
	});

	it('shows what accepting really did instead of a blanket success', () => {
		renderInbox({
			offers: [],
			notice: 'caseHandover.offers.incoming.consentRequested'
		});
		expect(
			screen.getByTestId('case-handover-offers-notice').textContent
		).toBe('caseHandover.offers.incoming.consentRequested');
	});

	it('renders nothing at all when there is no offer and no error', () => {
		const { container } = render(
			<CaseHandoverOffersInboxView
				offers={[]}
				expanded
				onToggle={vi.fn()}
				onAccept={vi.fn()}
				onDecline={vi.fn()}
			/>
		);
		expect(container.innerHTML).toBe('');
	});

	it('counts the open offers in the badge', () => {
		renderInbox({ offers: [offer, { ...offer, offerId: 8 }] });
		expect(
			screen.getByTestId('case-handover-offer-badge').textContent
		).toBe('2');
	});

	it('offers accept and decline for a recipient-pending offer', () => {
		const props = renderInbox();
		fireEvent.click(button('case-handover-offer-accept-7'));
		expect(props.onAccept).toHaveBeenCalledWith(7);
		fireEvent.click(button('case-handover-offer-decline-7'));
		expect(props.onDecline).toHaveBeenCalledWith(7);
	});

	it('replaces the buttons with the consent notice once the client is asked', () => {
		renderInbox({
			offers: [{ ...offer, status: 'PENDING_CLIENT_CONSENT' }]
		});
		expect(screen.queryByTestId('case-handover-offer-accept-7')).toBeNull();
		expect(
			screen.getByText('caseHandover.offers.incoming.consentPending')
		).toBeTruthy();
	});

	it('localises the reason instead of printing the server label', () => {
		renderInbox();
		expect(
			screen.getByText(/caseHandover\.reason\.PLANNED_ABSENCE/)
		).toBeTruthy();
		expect(screen.queryByText(/Planned absence/)).toBeNull();
	});

	it('hides the list but keeps the badge when collapsed', () => {
		renderInbox({ expanded: false });
		expect(screen.getByTestId('case-handover-offer-badge')).toBeTruthy();
		expect(screen.queryByTestId('case-handover-offer-7')).toBeNull();
	});

	it('disables both actions while one is in flight', () => {
		renderInbox({ busyOfferId: 7 });
		expect(button('case-handover-offer-accept-7').disabled).toBe(true);
		expect(button('case-handover-offer-decline-7').disabled).toBe(true);
	});
});

describe('isOpenCaseHandoverOffer', () => {
	it.each(['PENDING_RECIPIENT_ACCEPT', 'PENDING', 'PENDING_CLIENT_CONSENT'])(
		'treats %s as still open',
		(status) => {
			expect(isOpenCaseHandoverOffer({ ...offer, status })).toBe(true);
		}
	);

	it.each(['GRANTED', 'RECIPIENT_DECLINED', 'WITHDRAWN', 'EXPIRED'])(
		'treats %s as closed',
		(status) => {
			expect(isOpenCaseHandoverOffer({ ...offer, status })).toBe(false);
		}
	);
});

/** Stand-in for i18next's `t`: echoes the key it was asked for. */
const echoTranslate = vi.fn((key: string) => key) as any;

describe('offerActionErrorMessage', () => {
	it('names the situation the contract reports', () => {
		expect(
			offerActionErrorMessage(echoTranslate, FETCH_ERRORS.CONFLICT)
		).toBe('caseHandover.offers.error.conflict');
		expect(
			offerActionErrorMessage(echoTranslate, FETCH_ERRORS.FORBIDDEN)
		).toBe('caseHandover.offers.error.forbidden');
		expect(
			offerActionErrorMessage(echoTranslate, FETCH_ERRORS.NO_MATCH)
		).toBe('caseHandover.offers.error.notFound');
		expect(offerActionErrorMessage(echoTranslate, undefined)).toBe(
			'caseHandover.offers.error.actionFailed'
		);
	});
});

describe('CaseHandoverOfferBadge', () => {
	it('stays away when there is nothing to count', () => {
		const { container } = render(<CaseHandoverOfferBadge count={0} />);
		expect(container.innerHTML).toBe('');
	});
});

describe('CaseHandoverOutgoingOfferView', () => {
	it('lets the offering counsellor take the offer back', () => {
		const onWithdraw = vi.fn();
		render(
			<CaseHandoverOutgoingOfferView
				offer={{ ...offer, targetConsultantName: 'Kim Grothe' }}
				onWithdraw={onWithdraw}
			/>
		);
		fireEvent.click(button('case-handover-offer-withdraw'));
		expect(onWithdraw).toHaveBeenCalled();
	});

	it('disables the withdraw button while the request is running', () => {
		render(
			<CaseHandoverOutgoingOfferView
				offer={offer}
				isWithdrawing
				onWithdraw={vi.fn()}
			/>
		);
		expect(button('case-handover-offer-withdraw').disabled).toBe(true);
	});
});

describe('offer acceptance access semantics', () => {
	it.each([
		['GRANTED', 'CO_ACCESS', 'caseHandover.list.accessGranted'],
		['GRANTED', 'TAKEOVER', 'caseHandover.offers.incoming.accepted'],
		[
			'PENDING_CLIENT_CONSENT',
			'CO_ACCESS',
			'caseHandover.offers.incoming.consentRequested'
		]
	])(
		'renders %s / %s without claiming another access mode',
		(status, accessType, key) => {
			expect(
				offerAcceptanceNotice(echoTranslate, {
					status,
					accessType
				} as any)
			).toBe(key);
		}
	);
});
