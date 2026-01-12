---
description: 'Matrix SDK patterns, client service, real-time features, and WebRTC for ORISO Frontend'
globs:
    [
        'src/services/**/*.ts',
        'src/components/**/*matrix*.tsx',
        'src/hooks/**/*matrix*.tsx'
    ]
---

# Matrix Integration

## Overview

ORISO Frontend uses Matrix JS SDK for real-time messaging, presence, and WebRTC calls. The Matrix client is managed through a singleton service pattern.

## Matrix Client Service

### Singleton Pattern

**MatrixClientService is a singleton:**

```typescript
// ✅ Good: Singleton service
export class MatrixClientService {
	private client: MatrixClient | null = null;

	// Singleton instance
	private static instance: MatrixClientService;

	public static getInstance(): MatrixClientService {
		if (!MatrixClientService.instance) {
			MatrixClientService.instance = new MatrixClientService();
		}
		return MatrixClientService.instance;
	}
}
```

### Client Initialization

**Always wait for sync state 'PREPARED':**

```typescript
// ✅ Good: Wait for PREPARED state
public initializeClient(loginData: MatrixLoginData): void {
	this.client = createMatrixClient(loginData);

	this.client.startClient({
		initialSyncLimit: 20,
		pollTimeout: 30000,
		lazyLoadMembers: true
	});

	// Wait for sync to complete
	(this.client as any).once('sync', (state: string) => {
		if (state === 'PREPARED') {
			console.log('✅ Matrix client SYNCED and READY');
			// Initialize other services
			matrixCallService.initialize(this.client!);
			matrixLiveEventBridge.initialize(this.client!);
		}
	});
}
```

**Critical configuration:**

- `initialSyncLimit: 20` - Load last 20 messages per room
- `pollTimeout: 30000` - 30-second long-polling timeout
- `lazyLoadMembers: true` - Don't load all members immediately

## Sync State Management

### Sync States

**Matrix client sync states:**

- `PREPARED` - Client is synced and ready
- `SYNCING` - Currently syncing
- `ERROR` - Sync error occurred

**Always check sync state before operations:**

```typescript
// ✅ Good: Manual event listener pattern
const sendMessage = async (roomId: string, message: string) => {
	const client = matrixClientService.getClient();

	if (!client) {
		throw new Error('Matrix client not initialized');
	}

	// Check if already PREPARED
	if ((client as any).syncState === 'PREPARED') {
		await client.sendMessage(roomId, {
			msgtype: 'm.text',
			body: message
		});
		return;
	}

	// Wait for PREPARED state using event listener
	await new Promise<void>((resolve) => {
		const handler = (state: string) => {
			if (state === 'PREPARED') {
				(client as any).removeListener?.('sync', handler);
				(client as any).off?.('sync', handler);
				resolve();
			}
		};
		(client as any).once('sync', handler);
		(client as any).on('sync', handler);
	});

	await client.sendMessage(roomId, {
		msgtype: 'm.text',
		body: message
	});
};
```

**Alternative: Using waitForSyncState helper:**

```typescript
// ✅ Good: Check sync state using helper
const sendMessage = async (roomId: string, message: string) => {
	const client = matrixClientService.getClient();

	if (!client) {
		throw new Error('Matrix client not initialized');
	}

	// Wait for PREPARED state
	await matrixClientService.waitForSyncState('PREPARED');

	await client.sendMessage(roomId, {
		msgtype: 'm.text',
		body: message
	});
};
```

## Room Operations

### Getting Rooms

```typescript
// ✅ Good: Get user rooms
const rooms = matrixClientService.getRooms();

// ✅ Good: Get specific room
const room = matrixClientService.getRoom(roomId);
if (!room) {
	throw new Error('Room not found');
}
```

### Sending Messages

```typescript
// ✅ Good: Send message
await matrixClientService.sendMessage(roomId, 'Hello, world!');

// Message content structure
const content = {
	msgtype: 'm.text',
	body: 'Message text'
};
```

### Creating Rooms

```typescript
// ✅ Good: Create direct message room
const roomId = await matrixClientService.createDirectMessageRoom(userId);
```

## Real-Time Events

### Event Listeners

**Listen to Matrix events:**

```typescript
// ✅ Good: Event listener
useEffect(() => {
	const client = matrixClientService.getClient();
	if (!client) return;

	const handleRoomEvent = (event: MatrixEvent, room: Room) => {
		if (event.getType() === 'm.room.message') {
			// Handle new message
			const content = event.getContent();
			// ...
		}
	};

	client.on('Room.timeline', handleRoomEvent);

	return () => {
		client.removeListener('Room.timeline', handleRoomEvent);
	};
}, []);
```

### Live Event Bridge

**Use matrixLiveEventBridge for real-time notifications:**

```typescript
// ✅ Good: Live event bridge
matrixLiveEventBridge.initialize(client);

// Bridge handles:
// - New messages
// - Typing indicators
// - Presence updates
// - Room events
```

## WebRTC Calls

### Call Service

**Matrix call service handles WebRTC:**

```typescript
// ✅ Good: Initialize call service
matrixCallService.initialize(client);

// TURN/STUN servers are fetched automatically from Matrix homeserver
// No manual configuration needed
```

### Call Operations

```typescript
// ✅ Good: Start call
await matrixCallService.startCall(roomId);

// ✅ Good: Answer call
await matrixCallService.answerCall(callId);

// ✅ Good: End call
await matrixCallService.endCall(callId);
```

## Error Handling

### Connection Errors

**Handle connection errors gracefully:**

```typescript
// ✅ Good: Error handling
try {
	await matrixClientService.sendMessage(roomId, message);
} catch (error) {
	console.error('Failed to send message:', error);
	// Show user-friendly error
	showNotification('Failed to send message. Please try again.');
}
```

### Sync Errors

**Handle sync state errors:**

```typescript
// ✅ Good: Sync error handling
client.on('sync', (state: string, prevState: string | null, data?: any) => {
	if (state === 'ERROR') {
		console.error('Matrix sync error:', data);
		// Attempt reconnection or show error
	}
});
```

## Authentication

### Matrix Login

**Matrix authentication is integrated with Keycloak:**

```typescript
// ✅ Good: Get Matrix login data
const loginData = getMatrixAccessToken();

// Login data includes:
// - accessToken
// - userId
// - deviceId
```

## Best Practices

### Service Initialization Order

1. Initialize Matrix client
2. Wait for PREPARED sync state
3. Initialize call service
4. Initialize live event bridge
5. Start listening to events

### Resource Cleanup

**Always cleanup event listeners:**

```typescript
// ✅ Good: Cleanup
useEffect(() => {
	const client = matrixClientService.getClient();
	if (!client) return;

	const handler = (event) => {
		// Handle event
	};

	client.on('event', handler);

	return () => {
		client.removeListener('event', handler);
	};
}, []);
```

## Anti-Patterns to Avoid

1. **Operations before PREPARED**: Always wait for sync
2. **Missing error handling**: Handle connection/sync errors
3. **Memory leaks**: Cleanup event listeners
4. **Direct client access**: Use service methods
5. **Multiple client instances**: Use singleton pattern
6. **No timeout handling**: Set timeouts for operations

## Checklist

When working with Matrix:

- [ ] Client initialized via service
- [ ] Wait for PREPARED sync state
- [ ] Error handling implemented
- [ ] Event listeners cleaned up
- [ ] Service methods used (not direct client access)
- [ ] WebRTC calls use call service
- [ ] Real-time events use live event bridge

## References

- `src/services/matrixClientService.ts` - Matrix client service
- `src/services/matrixCallService.ts` - WebRTC call service
- `src/services/matrixLiveEventBridge.ts` - Real-time event bridge
- `src/hooks/useMatrixReady.tsx` - Matrix readiness hook
- Matrix JS SDK documentation
