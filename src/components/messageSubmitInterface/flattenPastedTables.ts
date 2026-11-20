/**
 * Pasted HTML → HTML the composer can hold.
 *
 * The composer has no table node, so ProseMirror dropped the table structure
 * of a pasted Word or mail table and ran the cell texts together
 * ("Spalte ASpalte B12", #2135 battle test). Each row becomes one paragraph
 * with its non-empty cells separated by " | "; inline formatting inside a
 * cell (bold, links, …) is kept. HTML without a table is returned unchanged.
 */
const CELL_SEPARATOR = ' | ';

export const flattenPastedTables = (html: string): string => {
	if (!/<table\b/i.test(html) || typeof DOMParser === 'undefined') {
		return html;
	}

	const doc = new DOMParser().parseFromString(html, 'text/html');
	doc.querySelectorAll('table').forEach((table) => {
		const rows = Array.from(table.querySelectorAll('tr'))
			.map((row) =>
				Array.from(row.children).filter((cell) =>
					cell.textContent?.trim()
				)
			)
			.filter((cells) => cells.length > 0)
			.map((cells) => {
				// Move the cells' own nodes over, so nothing is re-parsed.
				const paragraph = doc.createElement('p');
				cells.forEach((cell, index) => {
					if (index > 0) {
						paragraph.append(CELL_SEPARATOR);
					}
					paragraph.append(...Array.from(cell.childNodes));
				});
				paragraph.normalize();
				return paragraph;
			});
		table.replaceWith(...rows);
	});
	return doc.body.innerHTML;
};
