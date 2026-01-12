---
description: 'API call patterns, error handling, fetchData usage, and request management for ORISO Frontend'
globs: ['src/api/**/*.ts']
---

# API Patterns

## Overview

All API calls in ORISO Frontend must use the `fetchData` utility function. Never use direct `fetch` calls. This ensures consistent error handling, authentication, and CSRF protection.

## fetchData Utility

### Always Use fetchData

**Never use direct fetch calls:**

```typescript
// ✅ Good: Use fetchData utility
import { fetchData, FETCH_METHODS } from './fetchData';

export const apiGetUserData = async (): Promise<UserDataInterface> => {
	return fetchData({
		url: endpoints.userData,
		method: FETCH_METHODS.GET
	});
};

// ❌ Bad: Direct fetch call
export const apiGetUserData = async () => {
	const response = await fetch(endpoints.userData);
	return response.json();
};
```

### fetchData Parameters

```typescript
interface FetchDataProps {
	url: string; // API endpoint URL
	method: string; // HTTP method (use FETCH_METHODS constants)
	headersData?: object; // Additional headers
	rcValidation?: boolean; // RocketChat validation (legacy, Matrix migration)
	bodyData?: string; // Request body (JSON stringified)
	skipAuth?: boolean; // Skip authentication (public endpoints)
	responseHandling?: string[]; // Custom response handling
	timeout?: number; // Request timeout in ms
	signal?: AbortSignal; // Abort signal for cancellation
}
```

### HTTP Methods

**Always use FETCH_METHODS constants:**

```typescript
import { FETCH_METHODS } from './fetchData';

// ✅ Good: Use constants
fetchData({
	url: endpoints.userData,
	method: FETCH_METHODS.GET
});

fetchData({
	url: endpoints.updateUser,
	method: FETCH_METHODS.PUT,
	bodyData: JSON.stringify(data)
});

// ❌ Bad: String literals
fetchData({
	url: endpoints.userData,
	method: 'GET' // Use constant instead
});
```

## API Function Naming

### Naming Convention

**Pattern: `apiActionName.ts`**

- `apiGetUserData.ts` - GET request
- `apiPostRegistration.ts` - POST request
- `apiPutEmail.ts` - PUT request
- `apiPatchMessage.ts` - PATCH request
- `apiDeleteMessage.ts` - DELETE request

### Function Structure

```typescript
// ✅ Good: Standard API function structure
import { endpoints } from '../resources/scripts/endpoints';
import { UserDataInterface } from '../globalState/interfaces';
import { fetchData, FETCH_METHODS } from './fetchData';

export const apiGetUserData = async (
	responseHandling?: string[]
): Promise<UserDataInterface> => {
	const url = endpoints.userData;

	return fetchData({
		url: url,
		rcValidation: false,
		responseHandling,
		method: FETCH_METHODS.GET
	});
};
```

## Error Handling

### FETCH_ERRORS Constants

**Use standardized error constants:**

```typescript
import { FETCH_ERRORS } from './fetchData';

// Available error types:
FETCH_ERRORS.BAD_REQUEST; // 400
FETCH_ERRORS.UNAUTHORIZED; // 401
FETCH_ERRORS.FORBIDDEN; // 403
FETCH_ERRORS.NO_MATCH; // 404
FETCH_ERRORS.CONFLICT; // 409
FETCH_ERRORS.PRECONDITION_FAILED; // 412
FETCH_ERRORS.FAILED_DEPENDENCY; // 424
FETCH_ERRORS.GATEWAY_TIMEOUT; // 504
FETCH_ERRORS.TIMEOUT; // Request timeout
FETCH_ERRORS.ABORT; // Request aborted
```

### Response Handling

**Use `responseHandling` parameter for custom error handling:**

```typescript
// ✅ Good: Custom error handling
export const apiGetUserData = async (): Promise<UserDataInterface> => {
	try {
		return await fetchData({
			url: endpoints.userData,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.FORBIDDEN]
		});
	} catch (error) {
		if (error.message === FETCH_ERRORS.NO_MATCH) {
			// Handle 404
			return null;
		}
		if (error.message === FETCH_ERRORS.FORBIDDEN) {
			// Handle 403
			throw new Error('Access denied');
		}
		throw error;
	}
};
```

### Error Handling Patterns

**Never swallow errors silently:**

```typescript
// ✅ Good: Proper error handling
export const apiUpdateUser = async (data: UserData): Promise<void> => {
	try {
		await fetchData({
			url: endpoints.updateUser,
			method: FETCH_METHODS.PUT,
			bodyData: JSON.stringify(data)
		});
	} catch (error) {
		console.error('Failed to update user:', error);
		// Show user-friendly error message
		throw error;
	}
};

// ❌ Bad: Silent error swallowing
export const apiUpdateUser = async (data: UserData) => {
	try {
		await fetchData({
			/* ... */
		});
	} catch (error) {
		// Error ignored - bad!
	}
};
```

## Authentication

### Keycloak Token

**Authentication is handled automatically by fetchData:**

```typescript
// ✅ Good: Token handled automatically
fetchData({
	url: endpoints.userData,
	method: FETCH_METHODS.GET
	// skipAuth defaults to false, token added automatically
});

// ✅ Good: Skip auth for public endpoints
fetchData({
	url: endpoints.publicSettings,
	method: FETCH_METHODS.GET,
	skipAuth: true
});
```

**Token is retrieved from cookies:**

- Cookie name: `keycloak`
- Header format: `Authorization: Bearer ${accessToken}`

### CSRF Protection

**CSRF token is generated automatically by fetchData:**

- Token generated via `generateCsrfToken()` utility
- Sent in `X-CSRF-TOKEN` header
- Local development: Additional whitelist header

## Request Body

### JSON Body

**Always stringify JSON data:**

```typescript
// ✅ Good: Stringified JSON
fetchData({
	url: endpoints.updateUser,
	method: FETCH_METHODS.PUT,
	bodyData: JSON.stringify({
		email: 'user@example.com',
		name: 'John Doe'
	})
});

// ❌ Bad: Object passed directly
fetchData({
	url: endpoints.updateUser,
	method: FETCH_METHODS.PUT,
	bodyData: { email: 'user@example.com' } // Wrong!
});
```

## Request Cancellation

### AbortSignal

**Use AbortSignal for request cancellation:**

```typescript
// ✅ Good: Cancellable request
const controller = new AbortController();

useEffect(() => {
	const loadData = async () => {
		try {
			const data = await fetchData({
				url: endpoints.userData,
				method: FETCH_METHODS.GET,
				signal: controller.signal
			});
			setData(data);
		} catch (error) {
			if (error.message === FETCH_ERRORS.ABORT) {
				// Request was cancelled
				return;
			}
			// Handle other errors
		}
	};

	loadData();

	return () => {
		controller.abort();
	};
}, []);
```

### Timeout

**Set timeout for long-running requests:**

```typescript
// ✅ Good: Request with timeout
fetchData({
	url: endpoints.longRunningOperation,
	method: FETCH_METHODS.GET,
	timeout: 30000 // 30 seconds
});
```

## Response Handling

### Success Responses

**200/201 responses:**

- Automatically parsed as JSON (if Content-Type is application/json)
- Returned as resolved promise

**204 No Content:**

- Returns empty object `{}` by default
- Use `responseHandling: [FETCH_ERRORS.EMPTY]` to treat as error

### Error Responses

**Standard error handling:**

- 401 Unauthorized: Automatically redirects to login
- Other errors: Use `responseHandling` for custom handling
- Default: Redirects to error page

## Examples from Codebase

### GET Request

See `src/api/apiGetUserData.ts`:

```typescript
export const apiGetUserData = async (
	responseHandling?: string[]
): Promise<UserDataInterface> => {
	const url = endpoints.userData;

	return fetchData({
		url: url,
		rcValidation: false,
		responseHandling,
		method: FETCH_METHODS.GET
	});
};
```

### POST Request

```typescript
export const apiPostRegistration = async (
	data: RegistrationData
): Promise<RegistrationResponse> => {
	return fetchData({
		url: endpoints.registration,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(data),
		skipAuth: true // Registration is public
	});
};
```

## Anti-Patterns to Avoid

1. **Direct fetch calls**: Always use fetchData
2. **String literals for methods**: Use FETCH_METHODS constants
3. **Silent error swallowing**: Always handle errors
4. **Missing error handling**: Use try/catch or responseHandling
5. **Unstringified JSON**: Always JSON.stringify bodyData
6. **Missing authentication**: Set skipAuth only for public endpoints
7. **No timeout**: Set timeout for long-running requests

## Checklist

When creating an API function:

- [ ] Uses fetchData utility (not direct fetch)
- [ ] Uses FETCH_METHODS constants
- [ ] Proper TypeScript return type
- [ ] Error handling implemented
- [ ] JSON body stringified (if applicable)
- [ ] skipAuth set correctly (true for public endpoints)
- [ ] Follows naming convention (apiActionName)
- [ ] Proper file location (src/api/)

## References

- `src/api/fetchData.ts` - fetchData utility implementation
- `src/api/apiGetUserData.ts` - GET request example
- `src/api/apiPostRegistration.ts` - POST request example
- `src/utils/generateCsrfToken.ts` - CSRF token generation
