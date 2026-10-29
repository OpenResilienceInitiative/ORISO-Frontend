/**
 * The Beratungsstelle a shared link names (`?aid=`), on a group invitation
 * or an agency's registration link. Anything but a positive id is no link.
 */
export const getLinkAgencyId = (search: string): number | null => {
	const id = Number(new URLSearchParams(search).get('aid'));
	return Number.isInteger(id) && id > 0 ? id : null;
};
