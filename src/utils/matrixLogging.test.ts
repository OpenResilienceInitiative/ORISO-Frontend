import { beforeEach, describe, expect, it, vi } from 'vitest';

const { childSetLevel, rootSetLevel, originalGetChild, mockLogger } =
	vi.hoisted(() => {
		const childSetLevel = vi.fn();
		const rootSetLevel = vi.fn();
		const originalGetChild = vi.fn(() => ({
			setLevel: childSetLevel
		}));

		const mockLogger = {
			setLevel: rootSetLevel,
			getChild: originalGetChild
		};

		return { childSetLevel, rootSetLevel, originalGetChild, mockLogger };
	});

vi.mock('matrix-js-sdk/lib/logger', () => ({
	logger: mockLogger
}));

// eslint-disable-next-line import/first -- must load after vi.mock
import {
	createMatrixErrorAwareLogger,
	configureMatrixLogging,
	getMatrixClientLogger,
	resetMatrixLoggingForTests
} from './matrixLogging';

describe('matrixLogging', () => {
	beforeEach(() => {
		resetMatrixLoggingForTests();
		rootSetLevel.mockClear();
		childSetLevel.mockClear();
		originalGetChild.mockClear();
		mockLogger.getChild = originalGetChild;
	});

	it('does not change log level when verbose logging is enabled', () => {
		configureMatrixLogging('true');

		expect(rootSetLevel).not.toHaveBeenCalled();
	});

	it('sets error log level by default', () => {
		configureMatrixLogging();

		expect(rootSetLevel).toHaveBeenCalledWith('error');
	});

	it('sets error log level when verbose logging is disabled', () => {
		configureMatrixLogging('false');

		expect(rootSetLevel).toHaveBeenCalledWith('error');
	});

	it('keeps child loggers at error level in production', () => {
		configureMatrixLogging();

		const child = getMatrixClientLogger().getChild('sync');

		expect(originalGetChild).toHaveBeenCalledWith('sync');
		expect(childSetLevel).toHaveBeenCalledWith('error');
		expect(child).toBeDefined();
	});

	it('runs configuration only once', () => {
		configureMatrixLogging();
		configureMatrixLogging();

		expect(rootSetLevel).toHaveBeenCalledTimes(1);
	});

	it('observes child logger errors while preserving the SDK log output', () => {
		const rootError = vi.fn();
		const childError = vi.fn();
		const childLogger = {
			trace: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: childError,
			getChild: vi.fn()
		};
		const rootLogger = {
			trace: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: rootError,
			getChild: vi.fn(() => childLogger)
		};
		const observer = vi.fn();
		const observedLogger = createMatrixErrorAwareLogger(
			rootLogger,
			observer
		);

		observedLogger
			.getChild('[room encryption]')
			.error('Failed to process outgoing request', 0);

		expect(observer).toHaveBeenCalledWith(
			'Failed to process outgoing request',
			0
		);
		expect(childError).toHaveBeenCalledWith(
			'Failed to process outgoing request',
			0
		);
		expect(rootError).not.toHaveBeenCalled();
	});
});
