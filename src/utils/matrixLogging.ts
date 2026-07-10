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

/** @internal test helper */
export const resetMatrixLoggingForTests = (): void => {
	configured = false;
};
