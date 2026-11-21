import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ActivityItem, Comment, Issue } from '@/types';
import { useAuth } from './useAuth';

const REALTIME_DISABLED = import.meta.env.VITE_REALTIME === 'off';

type ConnectionState ='connecting' | 'connected' | 'disconnected';

interface RealtimeContextValue {
  status: ConnectionState;
  socket: Socket | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: 'disconnected',
  socket: null,
});

/**
 * Maintains the Socket.io connection and mirrors server events into the
 * TanStack Query cache so every connected teammate sees changes instantly.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const userId = user?.id;

  useEffect(() => {
    // Serverless hosts (Vercel) cannot keep a Socket.io server alive.
    if (!isAuthenticated || REALTIME_DISABLED) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
      return undefined;
    }

    const socketUrl = API_BASE.startsWith('http')
      ? API_BASE.replace(/\/api$/, '')
      : window.location.origin;
    const socket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;
    setStatus('connecting');

    const invalidateIssueEverywhere = () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('disconnected'));

    socket.on('issue:created', (issue: Issue) => {
      invalidateIssueEverywhere();
      queryClient.invalidateQueries({ queryKey: queryKeys.projectActivity(issue.projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(issue.projectId) });
    });

    socket.on('issue:updated', (issue: Issue) => {
      invalidateIssueEverywhere();
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(issue.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(issue.projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectActivity(issue.projectId) });
    });

    socket.on('issue:deleted', (payload: { issueId: string; projectId: string }) => {
      invalidateIssueEverywhere();
      queryClient.removeQueries({ queryKey: queryKeys.issue(payload.issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectActivity(payload.projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(payload.projectId) });
    });

    socket.on('issue:list-changed', () => invalidateIssueEverywhere());

    socket.on('comment:created', (comment: Comment & { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(comment.issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(comment.issueId) });
      if (comment.author && comment.author.id !== userId) {
        toast.message(`${comment.author.name} commented`, {
          description: comment.content.slice(0, 90),
        });
      }
    });

    socket.on('comment:updated', (comment: Comment) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(comment.issueId) });
    });

    socket.on('comment:deleted', (payload: { issueId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(payload.issueId) });
    });

    socket.on('attachment:added', (payload: { issueId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(payload.issueId) });
    });

    socket.on('attachment:deleted', (payload: { issueId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(payload.issueId) });
    });

    socket.on('activity:created', (activity: ActivityItem) => {
      if (activity.issueId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(activity.issueId) });
      }
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    });

    socket.on('project:updated', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    });

    socket.on('project:members.updated', (project: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members(project.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    });

    socket.on('project:deleted', (payload: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.removeQueries({ queryKey: queryKeys.project(payload.projectId) });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
    };
  }, [isAuthenticated, queryClient, userId]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ status, socket: socketRef.current }),
    [status],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
