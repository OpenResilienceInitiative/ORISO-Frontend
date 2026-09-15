import { describe, expect, it } from 'vitest';
import { getFormatChipVisibility } from './formatChipVisibility';

const consultantOnMySessions = true;

describe('getFormatChipVisibility', () => {
	// Tenant 14 on dev: supervision on, group chats off. The "Interna" filter
	// used to follow featureSupervisionEnabled and so offered a filter for a
	// conversation type that Träger cannot create at all.
	it('hides the internal filter when the Träger has group chats disabled', () => {
		expect(
			getFormatChipVisibility(
				{
					settings: {
						featureGroupChatV2Enabled: false,
						featureSupervisionEnabled: true
					}
				},
				consultantOnMySessions
			)
		).toEqual({
			createGroupChat: false,
			groups: false,
			internalGroup: false
		});
	});

	it('offers both filters and the create entry when group chats are enabled', () => {
		expect(
			getFormatChipVisibility(
				{ settings: { featureGroupChatV2Enabled: true } },
				consultantOnMySessions
			)
		).toEqual({ createGroupChat: true, groups: true, internalGroup: true });
	});

	it('follows the per-format flags the create flow already honours', () => {
		expect(
			getFormatChipVisibility(
				{
					settings: {
						featureGroupChatV2Enabled: true,
						featureSelfHelpGroupsEnabled: false
					}
				},
				consultantOnMySessions
			)
		).toEqual({
			createGroupChat: false,
			groups: false,
			internalGroup: true
		});
	});

	it('shows nothing outside the counsellor toolbar', () => {
		expect(
			getFormatChipVisibility(
				{ settings: { featureGroupChatV2Enabled: true } },
				false
			)
		).toEqual({
			createGroupChat: false,
			groups: false,
			internalGroup: false
		});
	});
});
