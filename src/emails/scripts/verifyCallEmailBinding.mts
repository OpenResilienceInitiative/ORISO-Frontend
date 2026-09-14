import { readFileSync } from 'node:fs';
import path from 'node:path';

const CALL_IDS = [
	'anruf-erinnerung',
	'anruf-einladung',
	'anruf-verpasst'
] as const;
const TONES = ['de-sie', 'de-du', 'en'] as const;
const PARTS = ['html', 'txt'] as const;

const [frontendArgument, userServiceArgument, ...extraArguments] =
	process.argv.slice(2);
if (!frontendArgument || !userServiceArgument || extraArguments.length > 0) {
	throw new Error(
		'usage: verifyCallEmailBinding.mts <frontend-root> <userservice-root>'
	);
}

const frontendRoot = path.resolve(frontendArgument);
const userServiceRoot = path.resolve(userServiceArgument);
const frontendEmails = path.join(frontendRoot, 'src/emails/dist');
const userServiceEmails = path.join(
	userServiceRoot,
	'src/main/resources/emails'
);

const read = (file: string): string => readFileSync(file, 'utf8');
const parseCatalogue = (root: string) =>
	JSON.parse(read(path.join(root, 'catalogue.json'))) as {
		mails: Record<string, unknown>;
	};

const frontendCatalogue = parseCatalogue(frontendEmails);
const userServiceCatalogue = parseCatalogue(userServiceEmails);
let compared = 0;

for (const id of CALL_IDS) {
	const frontendEntry = frontendCatalogue.mails[id];
	const userServiceEntry = userServiceCatalogue.mails[id];
	if (!frontendEntry || !userServiceEntry) {
		throw new Error(`missing call catalogue entry: ${id}`);
	}
	if (JSON.stringify(frontendEntry) !== JSON.stringify(userServiceEntry)) {
		throw new Error(`call catalogue entry differs between repositories: ${id}`);
	}

	for (const tone of TONES) {
		for (const part of PARTS) {
			const relative = path.join(tone, `${id}.${part}`);
			const frontendFile = path.join(frontendEmails, 'plain', relative);
			const userServiceFile = path.join(userServiceEmails, relative);
			if (read(frontendFile) !== read(userServiceFile)) {
				throw new Error(`call template differs between repositories: ${relative}`);
			}
			compared += 1;
		}
	}
}

console.log(
	`call-email binding: ${compared} native assets and ${CALL_IDS.length} catalogue entries match`
);
