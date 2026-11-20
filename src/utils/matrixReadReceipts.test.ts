import { describe, expect, it } from 'vite-plus/test';
import { counterpartReaders } from './matrixReadReceipts';

const asker = '@asker:example.org';
const counsellor = '@counsellor:example.org';
const session = (item: any, isGroup = false) => ({ isGroup, item });

describe('counterpartReaders (FE#1802, ADR-002)', () => {
	it('names the asker for the counsellor in a 1:1', () => {
		expect(
			counterpartReaders(
				session({
					askerMatrixUserId: asker,
					consultantMatrixUserId: counsellor
				}),
				counsellor
			)
		).toEqual([asker]);
	});

	it('names the assigned counsellor for the asker in a 1:1', () => {
		expect(
			counterpartReaders(
				session({
					askerMatrixUserId: asker,
					consultantMatrixUserId: counsellor
				}),
				asker
			)
		).toEqual([counsellor]);
	});

	it('falls back to any other member when the counterpart is unknown or it is a group', () => {
		expect(
			counterpartReaders(session({ askerMatrixUserId: asker }), asker)
		).toBeUndefined();
		expect(
			counterpartReaders(
				session(
					{
						askerMatrixUserId: asker,
						consultantMatrixUserId: counsellor
					},
					true
				),
				counsellor
			)
		).toBeUndefined();
	});
});
