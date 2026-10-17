import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useEvents(user) {
  const queryClient = useQueryClient();
  const [liveStatus, setLiveStatus] = useState('disconnected'); // 'live' | 'polling' | 'disconnected'
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (!user) {
      setLiveStatus('disconnected');
      return;
    }

    let fallbackInterval = null;

    const invalidateTicketCaches = (ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['adminQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });

      if (ticketId) {
        queryClient.invalidateQueries({ queryKey: ['ticket', String(ticketId)] });
        queryClient.invalidateQueries({ queryKey: ['adminTicket', String(ticketId)] });
        queryClient.invalidateQueries({ queryKey: ['adminDraft', String(ticketId)] });
      }
    };

    const showToast = (msg) => {
      setToastMessage(msg);
      setTimeout(() => {
        setToastMessage((curr) => (curr === msg ? null : curr));
      }, 4500);
    };

    const startPollingFallback = () => {
      if (fallbackInterval) return;
      setLiveStatus('polling');
      fallbackInterval = setInterval(() => {
        invalidateTicketCaches();
      }, 15_000);
    };

    const stopPollingFallback = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const es = new EventSource('/api/v1/events', { withCredentials: true });

    es.onopen = () => {
      stopPollingFallback();
      setLiveStatus('live');
      invalidateTicketCaches();
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          setLiveStatus('live');
          return;
        }

        invalidateTicketCaches(data.ticketId);

        if (data.type === 'message.created') {
          showToast(`New message received on Ticket #${data.ticketId}`);
        } else if (data.type === 'ticket.updated') {
          showToast(`Ticket #${data.ticketId} status updated`);
        } else if (data.type === 'ticket.created' && user.role === 'admin') {
          showToast(`New support ticket #${data.ticketId} arrived`);
        } else if (data.type === 'ai.completed' && user.role === 'admin') {
          showToast(`AI classification completed for Ticket #${data.ticketId}`);
        }
      } catch {
        // Ignore non-JSON comments
      }
    };

    es.onerror = () => {
      // Browser EventSource will attempt auto-reconnect; activate 15s polling fallback meanwhile
      startPollingFallback();
    };

    return () => {
      stopPollingFallback();
      es.close();
    };
  }, [user?.id, user?.role, queryClient]);

  return { liveStatus, toastMessage, dismissToast: () => setToastMessage(null) };
}