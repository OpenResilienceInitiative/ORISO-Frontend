/**
 * Draft bookkeeping shared by the composer, the sessions list, and the drafts
 * centre.
 *
 * Drafts themselves are **not** stored here. They live server-side
 * (`useDraftMessage` → `apiUpsertUserDraft` → UserService `/users/drafts`) and
 * are encrypted with the room key for encrypted rooms. The local plaintext
 * store this module used to own was removed for #1071: on the shared PCs that
 * counselling agencies run, anything left in Web Storage is readable by the
 * next person at the machine. Residues from older builds are swept by
 * `purgeLegacyDraftStorage` (`clientStorageHygiene.ts`).
 */
export const DRAFTS_UPDATED_EVENT = 'oriso:drafts-updated';
export const REMOTE_DRAFT_INDEX_SCOPE = 'scope:__draft-index__|thread:main';

/**
 * A draft only counts as a draft when it actually carries text (#976).
 *
 * TipTap serialises an empty document as markup (`<p></p>`, `<p><br></p>`), so
 * an emptiness check has to look past the tags — otherwise a merely visited
 * conversation persists a zero-content draft row, and the drafts badge, which
 * counts rows, keeps showing a draft that no view can ever open.
 *
 * E2EE drafts are opaque ciphertext without markup and therefore always count.
 */
export const hasDraftContent = (text?: string | null): boolean => {
	if (!text) {
		return false;
	}
	return (
		text
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;|&#160;/gi, ' ')
			.replace(/[\u00a0\u200b]/g, ' ')
			.trim().length > 0
	);
};
