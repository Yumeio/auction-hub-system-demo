import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/api';
import type { AuctionDetailResponse, Auction, Notification } from '@/api/types';

export function useAuctionSSE(
    auctionId: number | null,
    onUpdate: (data: AuctionDetailResponse) => void
) {
    const eventSourceRef = useRef<EventSource | null>(null);
    const retryCountRef = useRef(0);
    const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const maxRetries = 3;
    const mountedRef = useRef(true);

    const resetHeartbeatTimeout = useCallback(() => {
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }

        // Reconnect if no message in 40s
        heartbeatTimeoutRef.current = setTimeout(() => {
            console.log('Heartbeat timeout - reconnecting');
            eventSourceRef.current?.close();
            connect();
        }, 40000);
    }, []);

    const connect = useCallback(() => {
        if (!auctionId || !mountedRef.current) return;

        eventSourceRef.current = apiClient.sse.subscribeToAuction(auctionId, onUpdate);

        // Handle heartbeat events
        eventSourceRef.current.addEventListener('heartbeat', () => {
            resetHeartbeatTimeout();
        });

        // Handle auction_update events
        eventSourceRef.current.addEventListener('auction_update', (event) => {
            try {
                const data = JSON.parse(event.data);
                onUpdate(data);
                resetHeartbeatTimeout();
            } catch (e) {
                console.error('Failed to parse SSE data:', e);
            }
        });

        eventSourceRef.current.onerror = () => {
            eventSourceRef.current?.close();

            if (retryCountRef.current < maxRetries && mountedRef.current) {
                // Exponential backoff: 1s, 2s, 4s, 8s, ... max 60s
                const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 60000);
                console.log(`SSE error, retry ${retryCountRef.current + 1}/${maxRetries} in ${delay}ms`);

                setTimeout(() => {
                    if (mountedRef.current) {
                        retryCountRef.current++;
                        connect();
                    }
                }, delay);
            } else {
                console.error('SSE max retries reached or component unmounted');
            }
        };

        eventSourceRef.current.onopen = () => {
            retryCountRef.current = 0;  // Reset on success
            resetHeartbeatTimeout();
        };

    }, [auctionId, onUpdate, resetHeartbeatTimeout]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            retryCountRef.current = maxRetries;  // Prevent retry on unmount
            if (heartbeatTimeoutRef.current) {
                clearTimeout(heartbeatTimeoutRef.current);
            }
            eventSourceRef.current?.close();
        };
    }, [connect]);

    const close = useCallback(() => {
        mountedRef.current = false;
        retryCountRef.current = maxRetries;
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }
        eventSourceRef.current?.close();
    }, []);

    return { close };
}

export function useActiveAuctionsSSE(onUpdate: (data: Auction[]) => void) {
    const eventSourceRef = useRef<EventSource | null>(null);
    const retryCountRef = useRef(0);
    const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const maxRetries = 3;
    const mountedRef = useRef(true);

    const resetHeartbeatTimeout = useCallback(() => {
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }
        heartbeatTimeoutRef.current = setTimeout(() => {
            console.log('Auctions heartbeat timeout - reconnecting');
            eventSourceRef.current?.close();
            connect();
        }, 40000);
    }, []);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;

        eventSourceRef.current = apiClient.sse.subscribeToActiveAuctions(onUpdate);

        eventSourceRef.current.addEventListener('heartbeat', () => {
            resetHeartbeatTimeout();
        });

        eventSourceRef.current.addEventListener('auctions_update', (event) => {
            try {
                const data = JSON.parse(event.data);
                onUpdate(data.auctions);
                resetHeartbeatTimeout();
            } catch (e) {
                console.error('Failed to parse auctions SSE:', e);
            }
        });

        eventSourceRef.current.onerror = () => {
            eventSourceRef.current?.close();
            if (retryCountRef.current < maxRetries && mountedRef.current) {
                const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 60000);
                setTimeout(() => {
                    if (mountedRef.current) {
                        retryCountRef.current++;
                        connect();
                    }
                }, delay);
            }
        };

        eventSourceRef.current.onopen = () => {
            retryCountRef.current = 0;
            resetHeartbeatTimeout();
        };
    }, [onUpdate, resetHeartbeatTimeout]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            retryCountRef.current = maxRetries;
            if (heartbeatTimeoutRef.current) {
                clearTimeout(heartbeatTimeoutRef.current);
            }
            eventSourceRef.current?.close();
        };
    }, [connect]);

    const close = useCallback(() => {
        mountedRef.current = false;
        retryCountRef.current = maxRetries;
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }
        eventSourceRef.current?.close();
    }, []);

    return { close };
}

export function useNotificationsSSE(onUpdate: (data: Notification[]) => void) {
    const eventSourceRef = useRef<EventSource | null>(null);
    const retryCountRef = useRef(0);
    const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const maxRetries = 3;
    const mountedRef = useRef(true);

    const resetHeartbeatTimeout = useCallback(() => {
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }
        heartbeatTimeoutRef.current = setTimeout(() => {
            console.log('Notifications heartbeat timeout - reconnecting');
            eventSourceRef.current?.close();
            connect();
        }, 40000);
    }, []);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;

        eventSourceRef.current = apiClient.sse.subscribeToNotifications(onUpdate);

        eventSourceRef.current.addEventListener('heartbeat', () => {
            resetHeartbeatTimeout();
        });

        // Handle 'message' event (fixed event type)
        eventSourceRef.current.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                onUpdate(data);  // Array of notifications
                resetHeartbeatTimeout();
            } catch (e) {
                console.error('Failed to parse notifications SSE:', e);
            }
        });

        eventSourceRef.current.onerror = () => {
            eventSourceRef.current?.close();
            if (retryCountRef.current < maxRetries && mountedRef.current) {
                const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 60000);
                console.log(`Notifications SSE error, retry ${retryCountRef.current + 1}/${maxRetries} in ${delay}ms`);
                setTimeout(() => {
                    if (mountedRef.current) {
                        retryCountRef.current++;
                        connect();
                    }
                }, delay);
            }
        };

        eventSourceRef.current.onopen = () => {
            retryCountRef.current = 0;
            resetHeartbeatTimeout();
        };
    }, [onUpdate, resetHeartbeatTimeout]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            retryCountRef.current = maxRetries;
            if (heartbeatTimeoutRef.current) {
                clearTimeout(heartbeatTimeoutRef.current);
            }
            eventSourceRef.current?.close();
        };
    }, [connect]);

    const close = useCallback(() => {
        mountedRef.current = false;
        retryCountRef.current = maxRetries;
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }
        eventSourceRef.current?.close();
    }, []);

    return { close };
}
