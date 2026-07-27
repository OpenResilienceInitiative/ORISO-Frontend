// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
	filesFromDataTransfer,
	hasComposerFiles
} from './composerFileDropPaste';

const fileList = (files: File[]): FileList =>
	Object.assign(
		files.reduce(
			(acc, file, index) => Object.assign(acc, { [index]: file }),
			{}
		),
		{ length: files.length }
	) as unknown as FileList;

describe('composer file drop/paste helpers', () => {
	it('extracts files from a data transfer', () => {
		const png = new File(['x'], 'a.png', { type: 'image/png' });
		const pdf = new File(['x'], 'b.pdf', { type: 'application/pdf' });

		const files = filesFromDataTransfer({ files: fileList([png, pdf]) });

		expect(files.map((file) => file.name)).toEqual(['a.png', 'b.pdf']);
		expect(hasComposerFiles({ files: fileList([png]) })).toBe(true);
	});

	it('is safe on missing input', () => {
		expect(filesFromDataTransfer(null)).toEqual([]);
		expect(hasComposerFiles(undefined)).toBe(false);
	});
});
