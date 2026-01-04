import { useEffect, useState } from 'react';

/**
 * Hook to request notification permission on app load
 * Critical for receiving incoming call notifications
 */
export const useNotificationPermission = () => {
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

    useEffect(() => {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return;
        }

        // Get current permission status
        setPermissionStatus(Notification.permission);

        // If permission is default (not asked yet), request it
        if (Notification.permission === 'default') {
            console.log('🔔 Requesting notification permission for incoming calls...');
            
            // Small delay to not overwhelm user on first load
            const timer = setTimeout(() => {
                Notification.requestPermission().then((permission) => {
                    setPermissionStatus(permission);
                    if (permission === 'granted') {
                        console.log('✅ Notification permission granted');
                        // Show a test notification
                        new Notification('Benachrichtigungen aktiviert', {
                            body: 'Sie erhalten jetzt Benachrichtigungen für eingehende Anrufe.',
                            icon: '/favicon.ico',
                            tag: 'notification-enabled'
                        });
                    } else if (permission === 'denied') {
                        console.warn('⚠️ Notification permission denied - user will not receive call notifications');
                    }
                });
            }, 2000); // Wait 2 seconds after app loads

            return () => clearTimeout(timer);
        } else if (Notification.permission === 'granted') {
            console.log('✅ Notification permission already granted');
        } else {
            console.warn('⚠️ Notification permission denied - user will not receive call notifications');
        }
    }, []);

    return permissionStatus;
};

