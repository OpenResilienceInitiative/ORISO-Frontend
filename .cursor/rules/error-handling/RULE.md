---
description: 'Error handling patterns, error boundaries, and user feedback for ORISO Frontend'
alwaysApply: true
---

# Error Handling

## Overview

Proper error handling ensures a good user experience and helps with debugging. All errors must be handled gracefully with user-friendly messages.

## Error Boundaries

### React Error Boundaries

**Use Error Boundaries for component errors:**

```typescript
// ✅ Good: Error boundary
class ErrorBoundary extends React.Component {
	state = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('Error caught by boundary:', error, errorInfo);
		// Log to error tracking service
	}

	render() {
		if (this.state.hasError) {
			return <ErrorFallback error={this.state.error} />;
		}
		return this.props.children;
	}
}
```

**See `src/components/app/ErrorBoundary.tsx` for implementation.**

## API Error Handling

### fetchData Error Handling

**Use FETCH_ERRORS constants:**

```typescript
// ✅ Good: Standardized error handling
import { FETCH_ERRORS } from './fetchData';

try {
	const data = await fetchData({
		url: endpoints.userData,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.FORBIDDEN]
	});
} catch (error) {
	if (error.message === FETCH_ERRORS.NO_MATCH) {
		// Handle 404
		showNotification('User not found');
	} else if (error.message === FETCH_ERRORS.FORBIDDEN) {
		// Handle 403
		showNotification('Access denied');
	} else {
		// Handle other errors
		showNotification('An error occurred. Please try again.');
	}
}
```

### Error Response Handling

**Handle different error types:**

```typescript
// ✅ Good: Comprehensive error handling
const handleApiError = (error: Error) => {
	switch (error.message) {
		case FETCH_ERRORS.BAD_REQUEST:
			showNotification('Invalid request. Please check your input.');
			break;
		case FETCH_ERRORS.UNAUTHORIZED:
			// Automatically handled by fetchData (redirects to login)
			break;
		case FETCH_ERRORS.FORBIDDEN:
			showNotification(
				'You do not have permission to perform this action.'
			);
			break;
		case FETCH_ERRORS.NO_MATCH:
			showNotification('Resource not found.');
			break;
		case FETCH_ERRORS.CONFLICT:
			showNotification('This action conflicts with existing data.');
			break;
		case FETCH_ERRORS.TIMEOUT:
			showNotification('Request timed out. Please try again.');
			break;
		default:
			showNotification('An unexpected error occurred. Please try again.');
	}
};
```

## User-Facing Errors

### Translated Error Messages

**Never show raw error messages to users:**

```typescript
// ✅ Good: Translated, user-friendly message
import { useTranslation } from 'react-i18next';

const Component = () => {
	const { t } = useTranslation();

	try {
		await apiCall();
	} catch (error) {
		showNotification(t('error.api.generic'));
		// Log actual error for debugging
		console.error('API error:', error);
	}
};
```

### Notifications Context

**Use NotificationsContext for user feedback:**

```typescript
// ✅ Good: Notification system
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';

const Component = () => {
	const { addNotification } = useContext(NotificationsContext);

	const handleError = (error: Error) => {
		addNotification({
			type: NOTIFICATION_TYPE_ERROR,
			title: 'Error',
			text: 'An error occurred. Please try again.'
		});
	};
};
```

## Error Logging

### Development vs Production

**Log errors appropriately:**

```typescript
// ✅ Good: Conditional logging
const logError = (error: Error, context?: string) => {
	if (process.env.NODE_ENV === 'development') {
		console.error(`[${context}] Error:`, error);
	} else {
		// Send to error tracking service (e.g., Sentry)
		// errorTrackingService.captureException(error, { context });
	}
};
```

## Network Errors

### Network Error Handling

**Handle network failures:**

```typescript
// ✅ Good: Network error handling
try {
	await fetchData({ url, method: FETCH_METHODS.GET });
} catch (error) {
	if (error.message === FETCH_ERRORS.TIMEOUT) {
		showNotification(
			'Connection timed out. Please check your internet connection.'
		);
	} else if (error.message === FETCH_ERRORS.ABORT) {
		// Request was cancelled, no user notification needed
		return;
	} else {
		showNotification(
			'Network error. Please check your connection and try again.'
		);
	}
}
```

## Validation Errors

### Form Validation

**Handle validation errors:**

```typescript
// ✅ Good: Validation error handling
const handleSubmit = async (data: FormData) => {
	try {
		await apiPostRegistration(data);
	} catch (error) {
		if (error.message === FETCH_ERRORS.BAD_REQUEST) {
			// Validation errors in response
			const validationErrors = error.response?.data?.errors;
			if (validationErrors) {
				setFormErrors(validationErrors);
			} else {
				showNotification('Please check your input and try again.');
			}
		} else {
			showNotification('Registration failed. Please try again.');
		}
	}
};
```

## Graceful Degradation

### Feature Degradation

**Handle missing features gracefully:**

```typescript
// ✅ Good: Graceful degradation
const Component = () => {
	const [hasFeature, setHasFeature] = useState(false);

	useEffect(() => {
		checkFeatureAvailability()
			.then(setHasFeature)
			.catch(() => {
				// Feature not available, continue without it
				setHasFeature(false);
			});
	}, []);

	if (!hasFeature) {
		return <FallbackComponent />;
	}

	return <FeatureComponent />;
};
```

## Error Recovery

### Retry Logic

**Implement retry for transient errors:**

```typescript
// ✅ Good: Retry logic
const fetchWithRetry = async (url: string, retries = 3): Promise<any> => {
	for (let i = 0; i < retries; i++) {
		try {
			return await fetchData({ url, method: FETCH_METHODS.GET });
		} catch (error) {
			if (i === retries - 1) throw error;
			// Wait before retry
			await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
		}
	}
};
```

## Anti-Patterns to Avoid

1. **Silent error swallowing**: Always handle errors
2. **Raw error messages**: Translate and sanitize for users
3. **No error boundaries**: Use Error Boundaries for component errors
4. **Missing error logging**: Log errors for debugging
5. **No user feedback**: Show notifications for user-facing errors
6. **Unhandled promises**: Always handle async errors

## Checklist

When handling errors:

- [ ] Error boundaries for component errors
- [ ] API errors handled with FETCH_ERRORS constants
- [ ] User-friendly, translated error messages
- [ ] Error logging (dev console, prod tracking)
- [ ] Network errors handled gracefully
- [ ] Validation errors shown to user
- [ ] Graceful degradation for missing features
- [ ] No silent error swallowing

## References

- `src/components/app/ErrorBoundary.tsx` - Error boundary implementation
- `src/api/fetchData.ts` - Error handling in fetchData
- `src/components/error/errorHandling.ts` - Error handling utilities
- `src/globalState/provider/NotificationsProvider.tsx` - Notification system
