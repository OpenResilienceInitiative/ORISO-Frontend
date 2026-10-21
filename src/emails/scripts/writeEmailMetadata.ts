import { writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';

/** Apply the repository's existing formatter contract to generated metadata. */
export async function writeEmailMetadata(
	filePath: string,
	contents: string
): Promise<void> {
	const options = await resolveConfig(filePath);
	if (!options) {
		throw new Error(
			`No repository formatter configuration for ${filePath}`
		);
	}
	const formatted = await format(contents, {
		...options,
		filepath: filePath
	});
	await writeFile(filePath, formatted, 'utf8');
}
