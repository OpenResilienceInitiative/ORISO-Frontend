import type { Logger } from 'matrix-js-sdk/lib/logger';
import { logger } from 'matrix-js-sdk/lib/logger';

type MatrixLogger = typeof logger;

type LogLevelDesc = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

type LevelSettableLogger = Logger & {
	setLevel(level: LogLevelDesc, persist?: boolean): void;
};

const isLevelSettable = (target: Logger): target is LevelSettableLogger =>
	typeof (target as LevelSettableLogger).setLevel === 'function';

const setLoggerLevel = (target: Logger, level: LogLevelDesc): void => {
	if (isLevelSettable(target)) {
		target.setLevel(level);
	}
};

const PRODUCTION_LOG_LEVEL: LogLevelDesc = 'error';

let configured = false;

const isMatrixVerboseLoggingEnabled = (
	verboseLogging: string | undefined = process.env
		.REACT_APP_MATRIX_VERBOSE_LOGGING
): boolean => verboseLogging === 'true';

const applyProductionLogLevel = (rootLogger: MatrixLogger): void => {
	setLoggerLevel(rootLogger, PRODUCTION_LOG_LEVEL);

	const originalGetChild = rootLogger.getChild?.bind(rootLogger);
	if (!originalGetChild) {
		return;
	}

	rootLogger.getChild = (namespace: string) => {
		const child = originalGetChild(namespace);
		setLoggerLevel(child, PRODUCTION_LOG_LEVEL);
		return child;
	};
};

/**
 * Suppresses verbose matrix-js-sdk logging (e.g. FetchHttpApi sync traffic).
 * Set REACT_APP_MATRIX_VERBOSE_LOGGING=true to keep SDK debug output.
 * Safe to call multiple times; runs once.
 */
export const configureMatrixLogging = (
	verboseLogging: string | undefined = process.env
		.REACT_APP_MATRIX_VERBOSE_LOGGING
): void => {
	if (configured || isMatrixVerboseLoggingEnabled(verboseLogging)) {
		return;
	}

	configured = true;
	applyProductionLogLevel(logger);
};

/** Logger instance passed to Matrix client construction. */
export const getMatrixClientLogger = (): MatrixLogger => logger;

/**
 * Preserve the SDK's normal logging while observing errors from every child
 * logger. Rust crypto reports outgoing-request failures only through its
 * room-scoped logger, so observing the root logger alone misses them (#551).
 */
export const createMatrixErrorAwareLogger = (
	baseLogger: Logger,
	onError: (...messages: unknown[]) => void
): Logger => ({
	trace: (...messages: unknown[]) => baseLogger.trace(...messages),
	debug: (...messages: unknown[]) => baseLogger.debug(...messages),
	info: (...messages: unknown[]) => baseLogger.info(...messages),
	warn: (...messages: unknown[]) => baseLogger.warn(...messages),
	error: (...messages: unknown[]) => {
		onError(...messages);
		baseLogger.error(...messages);
	},
	getChild: (namespace: string) =>
		createMatrixErrorAwareLogger(baseLogger.getChild(namespace), onError)
});

/** @internal test helper */
export const resetMatrixLoggingForTests = (): void => {
	configured = false;
};
