import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CirclePlus, Inbox } from 'lucide-react';
import { IssueCard } from './IssueCard';
import { IssueCardSkeleton } from '@/components/ui/Feedback';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Issue, IssueStatus } from '@/types';

type Columns = Record<IssueStatus, Issue[]>;

export interface KanbanBoardProps {
  issues: Issue[];
  isLoading?: boolean;
  onStatusChange: (issue: Issue, status: IssueStatus) => void | Promise<unknown>;
  onEdit?: (issue: Issue) => void;
  onDelete?: (issue: Issue) => void;
  canEditIssue?: (issue: Issue) => boolean;
  canDeleteIssue?: (issue: Issue) => boolean;
  onCreate?: (status: IssueStatus) => void;
  canCreate?: boolean;
  members?: { id: string; name: string }[];
}

const emptyColumns = (): Columns => ({ todo: [], 'in-progress': [], done: [] });

const isStatusId = (id: unknown): id is IssueStatus => STATUS_ORDER.includes(id as IssueStatus);

/**
 * Column-first collision detection: whichever column the dragged card overlaps
 * wins, so a drop always resolves to a status (and empty columns stay reachable).
 * Card-level collisions are kept afterwards for dnd-kit's internal bookkeeping.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const collisions = closestCorners(args);
  const { collisionRect, droppableContainers } = args;
  const centre = {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  };

  const columnCollision = collisions.find((collision) => {
    if (!isStatusId(String(collision.id))) return false;
    const container = droppableContainers.find(
      (entry) => String(entry.id) === String(collision.id),
    );
    const rect = container?.rect.current;
    return Boolean(
      rect &&
      centre.x >= rect.left &&
      centre.x <= rect.right &&
      centre.y >= rect.top &&
      centre.y <= rect.bottom,
    );
  });

  if (!columnCollision) return collisions;
  return [columnCollision, ...collisions.filter((entry) => entry.id !== columnCollision.id)];
};

/**
 * Keyboard coordinates for a horizontal board: ←/→ jump between the three
 * columns (so a keyboard user can always reach another status), while ↑/↓ keep
 * the default sortable behaviour inside the current column.
 */
const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { context, currentCoordinates } = args;
  const isHorizontal = event.code === 'ArrowRight' || event.code === 'ArrowLeft';

  if (isHorizontal) {
    const rects = STATUS_ORDER.map((status) => ({
      status,
      rect: context.droppableRects.get(status),
    })).filter((entry): entry is { status: IssueStatus; rect: NonNullable<typeof entry.rect> } =>
      Boolean(entry.rect),
    );

    if (rects.length === STATUS_ORDER.length) {
      const inside = rects.findIndex(
        ({ rect }) => currentCoordinates.x >= rect.left && currentCoordinates.x <= rect.right,
      );
      const current =
        inside >= 0
          ? inside
          : rects.reduce(
              (best, entry, index) =>
                Math.abs(entry.rect.left - currentCoordinates.x) <
                Math.abs(rects[best].rect.left - currentCoordinates.x)
                  ? index
                  : best,
              0,
            );
      const next =
        event.code === 'ArrowRight'
          ? Math.min(current + 1, rects.length - 1)
          : Math.max(current - 1, 0);

      if (next !== current) {
        const target = rects[next].rect;
        return {
          x: target.left + Math.min(target.width / 2, 140),
          y: Math.min(Math.max(currentCoordinates.y, target.top + 60), target.bottom - 40),
        };
      }
    }
  }

  return sortableKeyboardCoordinates(event, args);
};

function groupIssues(issues: Issue[]): Columns {
  const columns = emptyColumns();
  issues.forEach((issue) => {
    columns[issue.status]?.push(issue);
  });
  return columns;
}

function Column({
  status,
  issues,
  children,
  onCreate,
  canCreate,
  isLoading,
}: {
  status: IssueStatus;
  issues: Issue[];
  children: React.ReactNode;
  onCreate?: (status: IssueStatus) => void;
  canCreate?: boolean;
  isLoading?: boolean;
}) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column', status } });
  const Icon = meta.icon;

  const columnThemes = {
    todo: 'border-slate-200/90 bg-slate-100/70',
    'in-progress': 'border-amber-200/70 bg-amber-50/20',
    done: 'border-emerald-200/70 bg-emerald-50/20',
  }[status];

  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label} column, ${issues.length} issues`}
      className={cn(
        'flex min-h-[460px] flex-col rounded-2xl border transition-all duration-150',
        columnThemes,
        isOver && 'border-brand-400 bg-brand-50/80 ring-2 ring-brand-300 shadow-sm',
      )}
      data-testid={`kanban-column-${status}`}
    >
      <header className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-black/[0.04]">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full shadow-xs', meta.dot)} aria-hidden="true" />
          <Icon className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight">{meta.label}</h2>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow-xs ring-1 ring-slate-200/80">
            {issues.length}
          </span>
        </div>
        {canCreate && onCreate && (
          <button
            type="button"
            onClick={() => onCreate(status)}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-brand-700 hover:shadow-xs"
            aria-label={`Create issue in ${meta.label}`}
          >
            <CirclePlus className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="scrollbar-thin flex-1 space-y-2.5 overflow-y-auto px-2.5 py-3">
        {isLoading ? (
          <>
            <IssueCardSkeleton />
            <IssueCardSkeleton />
          </>
        ) : issues.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300/80 text-xs text-slate-500">
            <Inbox className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="font-medium">No issues</span>
          </div>
        ) : (
          <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        )}
      </div>
    </section>
  );
}

/**
 * Kanban board with cross-column drag & drop.
 * Optimistic cache updates happen in `useUpdateIssueStatus`; this component keeps
 * a local mirror while dragging and persists the new status on drop.
 */
export function KanbanBoard({
  issues,
  isLoading,
  onStatusChange,
  onEdit,
  onDelete,
  canEditIssue,
  canDeleteIssue,
  onCreate,
  canCreate,
}: KanbanBoardProps) {
  const [columns, setColumns] = useState<Columns>(() => groupIssues(issues));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOriginStatus, setDragOriginStatus] = useState<IssueStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates }),
  );

  useEffect(() => {
    if (activeId) return;
    setColumns(groupIssues(issues));
  }, [issues, activeId]);

  const activeIssue = useMemo(
    () => issues.find((issue) => issue.id === activeId) ?? null,
    [issues, activeId],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const issue = issues.find((i) => i.id === event.active.id);
    setActiveId(String(event.active.id));
    setDragOriginStatus(issue?.status ?? null);
  };

  const findColumn = (id: string): IssueStatus | undefined => {
    if (STATUS_ORDER.includes(id as IssueStatus)) return id as IssueStatus;
    return STATUS_ORDER.find((status) => columns[status].some((issue) => issue.id === id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;

    setColumns((current) => {
      const moving = current[from].find((issue) => issue.id === active.id);
      if (!moving) return current;
      return {
        ...current,
        [from]: current[from].filter((issue) => issue.id !== active.id),
        [to]: [...current[to], { ...moving, status: to }],
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIssueSnapshot = issues.find((issue) => issue.id === active.id);
    const targetStatus = over ? findColumn(String(over.id)) : undefined;
    setActiveId(null);
    setDragOriginStatus(null);

    if (!activeIssueSnapshot || !targetStatus) return;
    if (targetStatus === dragOriginStatus) return;

    void onStatusChange(activeIssueSnapshot, targetStatus);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDragOriginStatus(null);
    setColumns(groupIssues(issues));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To pick up an issue press space or enter. Use the left and right arrows to change columns, the up and down arrows to move within a column, space or enter to drop, and escape to cancel.',
        },
        announcements: {
          onDragStart: ({ active }) => `Picked up issue ${active.id}`,
          onDragOver: ({ active, over }) =>
            over
              ? `Issue ${active.id} is over ${String(over.id)}`
              : `Issue ${active.id} is not over a column`,
          onDragEnd: ({ active, over }) =>
            over
              ? `Dropped issue ${active.id} on ${String(over.id)}`
              : `Issue ${active.id} was dropped`,
          onDragCancel: ({ active }) => `Dragging ${active.id} was cancelled`,
        },
      }}
    >
      <div className="grid gap-4 md:grid-cols-3" data-testid="kanban-board">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            issues={columns[status]}
            onCreate={onCreate}
            canCreate={canCreate}
            isLoading={isLoading}
          >
            {columns[status].map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
                canEdit={canEditIssue?.(issue)}
                canDelete={canDeleteIssue?.(issue)}
                dragDisabled={canEditIssue ? !canEditIssue(issue) : false}
              />
            ))}
          </Column>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeIssue ? (
          <div className="w-[280px] rotate-1">
            <IssueCard issue={activeIssue} dragDisabled />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
