/**
 * Global event emitter for new message events.
 * Allows WebsocketHandler to notify SessionStream about new messages.
 */

type MessageEventCallback = (data: { roomId?: string; sessionId?: number }) => void;

class MessageEventEmitter {
    private listeners: Set<MessageEventCallback> = new Set();

    /**
     * Register a callback for new message events
     */
    public on(callback: MessageEventCallback): void {
        this.listeners.add(callback);
        console.log('📡 Message event listener registered (total:', this.listeners.size, ')');
    }

    /**
     * Unregister a callback
     */
    public off(callback: MessageEventCallback): void {
        this.listeners.delete(callback);
        console.log('🧹 Message event listener removed (remaining:', this.listeners.size, ')');
    }

    /**
     * Emit a new message event to all registered listeners
     */
    public emit(data: { roomId?: string; sessionId?: number }): void {
        console.log('🔔 Emitting new message event to', this.listeners.size, 'listener(s)');
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('❌ Error in message event callback:', error);
            }
        });
    }
}

// Singleton instance
export const messageEventEmitter = new MessageEventEmitter();

