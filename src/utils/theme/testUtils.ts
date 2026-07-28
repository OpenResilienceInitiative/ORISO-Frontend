// Shared helpers for the OrisoScheme golden tests. Test-only module.
import * as fs from 'fs';
import * as path from 'path';
import {
	Hct,
	argbFromHex,
	labFromArgb
} from '@material/material-color-utilities';

/**
 * Reads the benchmark Figma MD3 export and returns the light "Schemes"
 * roles as { 'Role Name': '#rrggbb' } with lowercase hex.
 */
export const loadBenchmarkSchemes = (
	fixturePath: string
): Record<string, string> => {
	const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
	const roles: Record<string, string> = {};
	const walk = (node: unknown, trail: string[]) => {
		if (!node || typeof node !== 'object') return;
		const o = node as Record<string, unknown>;
		if (typeof o.hex === 'string' && trail[0] === 'Schemes') {
			roles[trail[1]] = (o.hex as string).toLowerCase();
			return;
		}
		for (const [key, value] of Object.entries(o)) {
			walk(value, [...trail, key]);
		}
	};
	walk(raw, []);
	return roles;
};

/** CIEDE2000 colour difference between two hex colours. */
export const deltaE2000 = (hexA: string, hexB: string): number => {
	const [l1, a1, b1] = labFromArgb(argbFromHex(hexA));
	const [l2, a2, b2] = labFromArgb(argbFromHex(hexB));

	const rad2deg = (rad: number) => (rad * 180) / Math.PI;
	const deg2rad = (deg: number) => (deg * Math.PI) / 180;

	const c1 = Math.sqrt(a1 * a1 + b1 * b1);
	const c2 = Math.sqrt(a2 * a2 + b2 * b2);
	const cBar = (c1 + c2) / 2;
	const g =
		0.5 *
		(1 -
			Math.sqrt(
				Math.pow(cBar, 7) / (Math.pow(cBar, 7) + Math.pow(25, 7))
			));
	const a1p = (1 + g) * a1;
	const a2p = (1 + g) * a2;
	const c1p = Math.sqrt(a1p * a1p + b1 * b1);
	const c2p = Math.sqrt(a2p * a2p + b2 * b2);
	const h1p = c1p === 0 ? 0 : (rad2deg(Math.atan2(b1, a1p)) + 360) % 360;
	const h2p = c2p === 0 ? 0 : (rad2deg(Math.atan2(b2, a2p)) + 360) % 360;

	const dLp = l2 - l1;
	const dCp = c2p - c1p;
	let dhp = 0;
	if (c1p * c2p !== 0) {
		dhp = h2p - h1p;
		if (dhp > 180) dhp -= 360;
		else if (dhp < -180) dhp += 360;
	}
	const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(deg2rad(dhp) / 2);

	const lBarP = (l1 + l2) / 2;
	const cBarP = (c1p + c2p) / 2;
	let hBarP: number;
	if (c1p * c2p === 0) {
		hBarP = h1p + h2p;
	} else if (Math.abs(h1p - h2p) <= 180) {
		hBarP = (h1p + h2p) / 2;
	} else if (h1p + h2p < 360) {
		hBarP = (h1p + h2p + 360) / 2;
	} else {
		hBarP = (h1p + h2p - 360) / 2;
	}

	const t =
		1 -
		0.17 * Math.cos(deg2rad(hBarP - 30)) +
		0.24 * Math.cos(deg2rad(2 * hBarP)) +
		0.32 * Math.cos(deg2rad(3 * hBarP + 6)) -
		0.2 * Math.cos(deg2rad(4 * hBarP - 63));
	const dTheta = 30 * Math.exp(-Math.pow((hBarP - 275) / 25, 2));
	const rc =
		2 *
		Math.sqrt(Math.pow(cBarP, 7) / (Math.pow(cBarP, 7) + Math.pow(25, 7)));
	const sl =
		1 +
		(0.015 * Math.pow(lBarP - 50, 2)) /
			Math.sqrt(20 + Math.pow(lBarP - 50, 2));
	const sc = 1 + 0.045 * cBarP;
	const sh = 1 + 0.015 * cBarP * t;
	const rt = -Math.sin(deg2rad(2 * dTheta)) * rc;

	return Math.sqrt(
		Math.pow(dLp / sl, 2) +
			Math.pow(dCp / sc, 2) +
			Math.pow(dHp / sh, 2) +
			rt * (dCp / sc) * (dHp / sh)
	);
};

/** Absolute HCT tone difference between two hex colours. */
export const toneDiff = (hexA: string, hexB: string): number =>
	Math.abs(
		Hct.fromInt(argbFromHex(hexA)).tone -
			Hct.fromInt(argbFromHex(hexB)).tone
	);

/**
 * Collects every `var(--m3-<role>)` consumed anywhere under the given
 * source roots. Generated, not maintained: when a new role token is used
 * in a stylesheet or component, the contract grows automatically.
 */
export const collectConsumedM3Tokens = (roots: string[]): string[] => {
	const found = new Set<string>();
	const exts = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx']);
	const visit = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === 'node_modules' || entry.name.startsWith('.'))
					continue;
				visit(full);
				continue;
			}
			if (!exts.has(path.extname(entry.name))) continue;
			const content = fs.readFileSync(full, 'utf8');
			for (const match of content.matchAll(
				/var\(\s*(--m3-[a-z0-9-]+)/g
			)) {
				found.add(match[1]);
			}
		}
	};
	roots.forEach(visit);
	return [...found].sort();
};
