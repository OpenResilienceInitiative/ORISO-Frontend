import { v4 as uuidv4 } from 'uuid';
import { appConfig } from './appConfig';
const requests: RequestLog[] = [];

export const REQUEST_LOGS_LIMIT = 10;
export const REQUEST_COLLECTOR_EVENT = 'requestCollector';

// The log is shown in the DevToolbar; a group's invite token is a secret.
const SECRET_QUERY_KEYS = new Set(['invitetoken']);

const decodedKey = (key: string) => {
	try {
		return decodeURIComponent(key.replace(/\+/g, ' ')).toLowerCase();
	} catch {
		return key.toLowerCase();
	}
};

/* Rewrites only the secret values; every other byte of the URL stays. */
const redactUrl = (url: string) => {
	const hashAt = url.indexOf('#');
	const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt);
	const hash = hashAt < 0 ? '' : url.slice(hashAt);
	const queryAt = beforeHash.indexOf('?');
	if (queryAt < 0) return url;
	const query = beforeHash
		.slice(queryAt + 1)
		.split('&')
		.map((pair) => {
			const [key] = pair.split('=', 1);
			return SECRET_QUERY_KEYS.has(decodedKey(key))
				? `${key}=[redacted]`
				: pair;
		})
		.join('&');
	return `${beforeHash.slice(0, queryAt + 1)}${query}${hash}`;
};

export class RequestLog {
	uuid: string = uuidv4();
	start: Date = new Date();
	url: string;
	method: string;
	status?: number;
	end?: Date;
	duration?: number;
	timeout?: number;

	constructor(url: string, method: string, timeout?: number) {
		this.url = redactUrl(url);
		this.method = method;
		this.timeout = timeout;
		requestCollector.update(this);
	}

	finish(status) {
		this.status = status;
		const end = new Date();
		this.end = end;
		this.duration = end.getTime() - this.start.getTime();
		requestCollector.update(this);
	}
}

export const requestCollector = {
	update(reqLog: RequestLog) {
		const i = requests.findIndex((request) => request.uuid === reqLog.uuid);
		if (i < 0) {
			requests.push(reqLog);
		} else {
			requests.splice(i, 1, reqLog);
		}
		requests.splice(
			0,
			requests.length -
				(appConfig?.requestCollector?.limit || REQUEST_LOGS_LIMIT)
		);
		window.dispatchEvent(new Event(REQUEST_COLLECTOR_EVENT));
	},

	get() {
		return requests.reverse();
	}
};
