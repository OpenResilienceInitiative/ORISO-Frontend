import { describe, expect, it } from 'vite-plus/test';
import { getFormatChipVisibility } from './formatChipVisibility';

const consultantOnMySessions = true;

/* "Direkteinladung erlauben" off for every medium (TenantService#332). */
const noDirectLinks = {
	featureDirectInviteChatEnabled: false,
	featureDirectInviteAudioEnabled: false,
	featureDirectInviteVideoEnabled: false
};

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
						featureSupervisionEnabled: true,
						...noDirectLinks
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

	// The create flow runs internal-only when that is the single available
	// format, so the toolbar entry must survive the Gesprächskreis being off.
	it('keeps the create entry while any format is still available', () => {
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
			createGroupChat: true,
			groups: false,
			internalGroup: true
		});
		expect(
			getFormatChipVisibility(
				{
					settings: {
						featureGroupChatV2Enabled: true,
						featureInternalGroupChatEnabled: false
					}
				},
				consultantOnMySessions
			)
		).toEqual({
			createGroupChat: true,
			groups: true,
			internalGroup: false
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

	// #1440: the Beratungsstelle's settings narrow what the Träger allows.
	it('follows the counsellor’s agencies within what the Träger allows', () => {
		const tenant = { settings: { featureGroupChatV2Enabled: true } };
		expect(
			getFormatChipVisibility(tenant, consultantOnMySessions, [
				{ id: 1, settings: { featureSelfHelpGroupsEnabled: false } }
			])
		).toEqual({
			createGroupChat: true,
			groups: false,
			internalGroup: true
		});
		expect(
			getFormatChipVisibility(tenant, consultantOnMySessions, [
				{
					id: 1,
					settings: {
						featureSelfHelpGroupsEnabled: false,
						featureInternalGroupChatEnabled: false,
						...noDirectLinks
					}
				}
			])
		).toEqual({
			createGroupChat: false,
			groups: false,
			internalGroup: false
		});
	});

	it('keeps a format one of several agencies still allows', () => {
		expect(
			getFormatChipVisibility(
				{ settings: { featureGroupChatV2Enabled: true } },
				consultantOnMySessions,
				[
					{ id: 1, settings: { featureGroupChatV2Enabled: false } },
					{
						id: 2,
						settings: {
							featureGroupChatV2Enabled: null,
							featureSelfHelpGroupsEnabled: true,
							featureInternalGroupChatEnabled: false
						}
					}
				]
			)
		).toEqual({
			createGroupChat: true,
			groups: true,
			internalGroup: false
		});
	});

	// #1795: a direct link is created in the same flow, so it keeps the entry.
	it('keeps the create entry for direct links when group chats are off', () => {
		expect(
			getFormatChipVisibility(
				{
					settings: {
						featureGroupChatV2Enabled: false,
						featureDirectInviteVideoEnabled: true
					}
				},
				consultantOnMySessions
			)
		).toEqual({
			createGroupChat: true,
			groups: false,
			internalGroup: false
		});
	});
});
