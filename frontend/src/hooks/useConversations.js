import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteConversation, listConversations } from '../api/conversations.js';

export const CONVERSATIONS_QUERY_KEY = ['conversations'];

/**
 * Saved conversations from the API.
 *
 * @param {Object} [params]
 * @param {(conversationId: string) => void} [params.onDeleted]
 */
export function useConversations({ onDeleted } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: ({ signal }) => listConversations({ signal }),
  });

  const removeFromList = (conversationId) => {
    queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (old) =>
      Array.isArray(old) ? old.filter((c) => c.id !== conversationId) : old
    );
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    onDeleted?.(conversationId);
  };

  const deleteMutation = useMutation({
    mutationFn: (conversationId) => deleteConversation(conversationId),
    onSuccess: (_, conversationId) => removeFromList(conversationId),
    onError: (error, conversationId) => {
      // Someone already removed it, which is what was asked for.
      if (error?.status === 404) removeFromList(conversationId);
    },
  });

  return {
    conversations: Array.isArray(query.data) ? query.data : [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    deleteMutation,
  };
}
