import {
	AGENCY_LINK_REFERER,
	agencyLinkReferer,
	withAgencyLinkReferer,
	showsAgencyLinkLabel
} from './agencyLinkLabel';

describe('agencyLinkReferer (FE#1870)', () => {
	it('marks a registration through the agency link', () => {
		expect(agencyLinkReferer({ aid: '12', agencyId: 12 })).toBe(
			AGENCY_LINK_REFERER
		);
	});

	it('fits the UserService referer pattern', () => {
		expect(AGENCY_LINK_REFERER).toMatch(/^[a-zA-Z0-9]{1,8}$/);
	});

	it('leaves postal-code registrations unmarked', () => {
		expect(agencyLinkReferer({ aid: null, agencyId: 12 })).toBeUndefined();
	});

	it('leaves a different agency, a counsellor link or a group join unmarked', () => {
		expect(agencyLinkReferer({ aid: '12', agencyId: 13 })).toBeUndefined();
		expect(
			agencyLinkReferer({
				aid: '12',
				agencyId: 12,
				viaConsultantLink: true
			})
		).toBeUndefined();
		expect(
			agencyLinkReferer({ aid: '12', agencyId: 12, viaGroupJoin: true })
		).toBeUndefined();
	});
});

describe('showsAgencyLinkLabel (FE#1870)', () => {
	it('shows the label by default for an agency-link enquiry', () => {
		expect(showsAgencyLinkLabel({ viaAgencyLink: true }, {})).toBe(true);
		expect(showsAgencyLinkLabel({ viaAgencyLink: true }, null)).toBe(true);
	});

	it('hides it when the Träger switched it off', () => {
		expect(
			showsAgencyLinkLabel(
				{ viaAgencyLink: true },
				{ featureAgencyLinkLabelEnabled: false }
			)
		).toBe(false);
	});

	it('never shows it for other enquiries', () => {
		expect(showsAgencyLinkLabel({}, {})).toBe(false);
		expect(showsAgencyLinkLabel({ viaAgencyLink: false }, {})).toBe(false);
	});
});

describe('withAgencyLinkReferer (FE#1870)', () => {
	it('adds referer only for agency-link registrations', () => {
		expect(withAgencyLinkReferer({ aid: '7', agencyId: '7' })).toEqual({
			referer: AGENCY_LINK_REFERER
		});
		expect(withAgencyLinkReferer({ aid: null, agencyId: '7' })).toEqual({});
	});
});
