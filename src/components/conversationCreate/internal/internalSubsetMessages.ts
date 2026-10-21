import {
	INTERNAL_SUBSET_REASON,
	InternalSubsetReason
} from '../../../api/apiCreateInternalSubsetChat';
import type { InternalChatRecipientScope } from './recipientScope';

/**
 * Translation keys for the dedicated-room flow of the internal chat picker
 * (#1772). Every refusal code of `POST /users/chat/internal-subset` has its
 * own plain-language message; a code the Frontend does not know yet falls
 * back to the generic one.
 */
const ERROR_KEYS: Record<InternalSubsetReason, string> = {
	[INTERNAL_SUBSET_REASON.RECIPIENTS_REQUIRED]:
		'groupChat.internal.error.recipientsRequired',
	[INTERNAL_SUBSET_REASON.RECIPIENT_UNKNOWN]:
		'groupChat.internal.error.recipientUnknown',
	[INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE]:
		'groupChat.internal.error.outOfScope',
	[INTERNAL_SUBSET_REASON.MEMBERSHIP_FAILED]:
		'groupChat.internal.error.membershipFailed',
	[INTERNAL_SUBSET_REASON.ENCRYPTION_REQUIRED]:
		'groupChat.internal.error.encryptionRequired',
	[INTERNAL_SUBSET_REASON.BUSY]: 'groupChat.internal.error.busy',
	[INTERNAL_SUBSET_REASON.NOT_AVAILABLE]:
		'groupChat.internal.error.notAvailable',
	[INTERNAL_SUBSET_REASON.DISABLED]: 'groupChat.internal.error.disabled',
	[INTERNAL_SUBSET_REASON.UNKNOWN]: 'groupChat.internal.error.unknown'
};

export const internalSubsetErrorKey = (reason: InternalSubsetReason): string =>
	ERROR_KEYS[reason] ?? ERROR_KEYS[INTERNAL_SUBSET_REASON.UNKNOWN];

const SCOPE_HINT_KEYS: Record<InternalChatRecipientScope, string> = {
	AGENCY: 'groupChat.internal.scope.AGENCY',
	TENANT: 'groupChat.internal.scope.TENANT',
	// The platform scope lists the Träger's directory until a platform-wide
	// directory exists (ORISO-Frontend#1269 follow-up), so it must not promise
	// more than that.
	PLATFORM: 'groupChat.internal.scope.TENANT'
};

export const recipientScopeHintKey = (
	scope: InternalChatRecipientScope
): string => SCOPE_HINT_KEYS[scope];

/** Copy that is not tied to a code or a scope. */
export const INTERNAL_SUBSET_NOTICE_KEYS = [
	'groupChat.internal.privateRoomHint',
	'groupChat.internal.noColleagues',
	'groupChat.internal.tooMany',
	'groupChat.internal.reusedNotice.title',
	'groupChat.internal.reusedNotice.text'
] as const;
