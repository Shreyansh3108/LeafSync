import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch('/auth/me'),
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (credentials) =>
      apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear();
    },
  });
}

// Author Hooks
export function useBooks() {
  return useQuery({
    queryKey: ['books'],
    queryFn: () => apiFetch('/books'),
  });
}

export function useTickets(status = '') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return useQuery({
    queryKey: ['tickets', status],
    queryFn: () => apiFetch(`/tickets${query}`),
  });
}

export function useTicketDetail(ticketId) {
  return useQuery({
    queryKey: ['ticket', String(ticketId)],
    queryFn: () => apiFetch(`/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useAddTicketMessage(ticketId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiFetch(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', String(ticketId)] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

// Admin Hooks
export function useAdminQueue(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, v);
    }
  });
  const qs = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['adminQueue', filters],
    queryFn: () => apiFetch(`/admin/tickets${qs}`),
  });
}

export function useAdminTicketDetail(ticketId) {
  return useQuery({
    queryKey: ['adminTicket', String(ticketId)],
    queryFn: () => apiFetch(`/admin/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
  });
}

export function usePatchAdminTicket(ticketId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(`/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminTicket', String(ticketId)] });
      qc.invalidateQueries({ queryKey: ['adminQueue'] });
      qc.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
}

export function useSendAdminReply(ticketId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, aiAssisted }) =>
      apiFetch(`/admin/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, aiAssisted }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminTicket', String(ticketId)] });
      qc.invalidateQueries({ queryKey: ['adminQueue'] });
      qc.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
}

export function useAddInternalNote(ticketId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiFetch(`/admin/tickets/${ticketId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminTicket', String(ticketId)] });
    },
  });
}

export function useTicketDraft(ticketId) {
  return useQuery({
    queryKey: ['adminDraft', String(ticketId)],
    queryFn: () => apiFetch(`/admin/tickets/${ticketId}/draft`),
    enabled: Boolean(ticketId),
  });
}

export function useRegenerateDraft(ticketId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/tickets/${ticketId}/draft/regenerate`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      qc.setQueryData(['adminDraft', String(ticketId)], data);
      qc.invalidateQueries({ queryKey: ['adminAiUsage'] });
    },
  });
}

export function useReclassifyTicket(ticketId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/tickets/${ticketId}/classify`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminTicket', String(ticketId)] });
      qc.invalidateQueries({ queryKey: ['adminDraft', String(ticketId)] });
      qc.invalidateQueries({ queryKey: ['adminQueue'] });
      qc.invalidateQueries({ queryKey: ['adminAiUsage'] });
    },
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiFetch('/admin/stats'),
  });
}

export function useAdminAiUsage() {
  return useQuery({
    queryKey: ['adminAiUsage'],
    queryFn: () => apiFetch('/admin/ai/usage'),
  });
}