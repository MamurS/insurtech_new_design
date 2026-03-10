import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useAgendaTasks } from '../hooks/useAgenda';
import { AgendaService } from '../services/agendaService';
import { DB } from '../services/db';
import { formatDate } from '../utils/dateUtils';
import AssignTaskModal from '../components/AssignTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import { DetailModal } from '../components/DetailModal';
import { usePageHeader } from '../context/PageHeaderContext';
import { CompactDateFilter } from '../components/CompactDateFilter';
import { toISODateString } from '../components/DatePickerInput';
import { useTheme } from '../theme/useTheme';
import {
    ClipboardList, Filter, Search, CheckCircle, Clock,
    AlertCircle, Briefcase, Plus, MoreHorizontal, ArrowRight, RefreshCw
} from 'lucide-react';
import { TaskStatus, AgendaTask, ReinsuranceSlip } from '../types';

const Agenda: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { setHeaderActions, setHeaderLeft } = usePageHeader();
    const filterRef = useRef<HTMLDivElement>(null);
    const { t } = useTheme();

    const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('PENDING');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Task Detail Modal State
    const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);
    const [selectedSlip, setSelectedSlip] = useState<ReinsuranceSlip | null>(null);

    // Fetch tasks
    const { data: tasks, isLoading, refetch } = useAgendaTasks(user?.id, statusFilter === 'ALL' ? undefined : statusFilter);

    const handleStatusFilterChange = (status: 'ALL' | TaskStatus) => {
        setStatusFilter(status);
        // Force refresh when switching tabs to ensure no duplicates from stale cache
        queryClient.invalidateQueries({ queryKey: ['agenda'] });
    };

    const handleTaskClick = async (task: AgendaTask) => {
        // If task is linked to an entity, navigate to it and mark as In Progress
        if (task.entityType && task.entityType !== 'OTHER' && task.entityId) {

            // Auto update status if PENDING
            if (task.status === 'PENDING') {
                await AgendaService.markTaskInProgress(task.id);
                // Invalidate immediately so next fetch reflects the change
                queryClient.invalidateQueries({ queryKey: ['agenda'] });
            }

            if (task.entityType === 'POLICY') {
                navigate(`/edit/${task.entityId}`);
            } else if (task.entityType === 'SLIP') {
                // Fetch slip and open modal instead of navigating
                const slip = await DB.getSlip(task.entityId);
                if (slip) {
                    setSelectedSlip(slip);
                } else {
                    console.error("Slip not found or deleted");
                }
            } else if (task.entityType === 'CLAIM') {
                navigate(`/claims/${task.entityId}`);
            }
        } else {
            // Open Modal for OTHER or unlinked tasks
            setSelectedTask(task);
        }
    };

    const getPriorityStyle = (p: string): React.CSSProperties => {
        switch(p) {
            case 'URGENT': return { background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}40` };
            case 'HIGH': return { background: t.warningBg, color: t.warning, border: `1px solid ${t.warning}40` };
            case 'MEDIUM': return { background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}30` };
            default: return { background: t.bgInput, color: t.text3, border: `1px solid ${t.border}` };
        }
    };

    // Quick Stats
    const pendingCount = tasks?.filter(t => t.status === 'PENDING').length || 0;
    const overdueCount = tasks?.filter(t => t.isOverdue).length || 0;

    // Header: stats badges left, action button right
    useEffect(() => {
        setHeaderLeft(
            <>
                {overdueCount > 0 && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: t.dangerBg, border: `1px solid ${t.danger}40` }}>
                        <span className="text-xs font-medium" style={{ color: t.danger }}>Overdue</span>
                        <span className="text-sm font-bold" style={{ color: t.danger }}>{overdueCount}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}40` }}>
                    <span className="text-xs font-medium" style={{ color: t.accent }}>Pending</span>
                    <span className="text-sm font-bold" style={{ color: t.accent }}>{pendingCount}</span>
                </div>
            </>
        );
        setHeaderActions(
            <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap"
                style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
            >
                <Plus size={16} /> New Task
            </button>
        );
        return () => { setHeaderActions(null); setHeaderLeft(null); };
    }, [overdueCount, pendingCount, setHeaderActions, setHeaderLeft, t]);

    // Filtered tasks with date filter
    const displayTasks = (tasks || [])
        .filter(tk => {
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                if (!tk.title.toLowerCase().includes(s) && !(tk.policyNumber || '').toLowerCase().includes(s)) return false;
            }
            if (priorityFilter !== 'all' && tk.priority !== priorityFilter) return false;
            // Date filter on dueDate
            if (dateFrom || dateTo) {
                const due = tk.dueDate ? tk.dueDate.slice(0, 10) : '';
                if (dateFrom && due < toISODateString(dateFrom)!) return false;
                if (dateTo && due > toISODateString(dateTo)!) return false;
            }
            return true;
        });

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.borderL}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none' };
    const selectStyle: React.CSSProperties = { padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.borderL}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none' };

    return (
        <div className="pb-20">
            {/* Sticky filter bar */}
            <div ref={filterRef} className="sticky top-0 z-30 sticky-filter-blur" style={{ background: t.bgApp }}>
            <div className="rounded-xl p-3" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: 32 }}
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => handleStatusFilterChange(e.target.value as any)}
                        style={selectStyle}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                    </select>

                    {/* Priority Filter */}
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="all">All Priorities</option>
                        <option value="URGENT">Urgent</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>

                    {/* Date Filter */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '280px' }}>
                        <select disabled style={selectStyle}>
                            <option>Due Date</option>
                        </select>
                        <CompactDateFilter
                            value={dateFrom}
                            onChange={(d) => setDateFrom(d)}
                            placeholder="From"
                        />
                        <CompactDateFilter
                            value={dateTo}
                            onChange={(d) => setDateTo(d)}
                            placeholder="To"
                        />
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-lg"
                        title="Refresh"
                        style={{ color: t.text4 }}
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} style={isLoading ? { color: t.accent } : undefined} />
                    </button>
                </div>
            </div>
            </div>{/* end sticky filter bar */}

            {/* Task List */}
            <div className="rounded-xl overflow-hidden mt-4" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                {isLoading ? (
                    <div className="p-12 text-center" style={{ color: t.text4 }}>Loading agenda...</div>
                ) : displayTasks.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center" style={{ color: t.text4 }}>
                        <CheckCircle size={48} className="mb-4" style={{ color: t.success, opacity: 0.3 }}/>
                        <p style={{ color: t.text3, fontSize: 15, fontWeight: 500 }}>All caught up!</p>
                        <p className="text-sm">No tasks found for the selected filter.</p>
                    </div>
                ) : (
                    <div style={{ borderColor: t.border }}>
                        {displayTasks.map((task, idx) => (
                            <div
                                key={task.id}
                                onClick={() => handleTaskClick(task)}
                                className="p-4 transition-colors cursor-pointer group flex flex-col md:flex-row gap-4 items-start md:items-center relative"
                                style={{ borderBottom: idx < displayTasks.length - 1 ? `1px solid ${t.border}` : undefined }}
                            >
                                {/* Priority Stripe */}
                                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{
                                    background: task.priority === 'URGENT' ? t.danger :
                                    task.priority === 'HIGH' ? t.warning :
                                    `${t.accent}60`
                                }}></div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold truncate" style={{ color: task.status === 'COMPLETED' ? t.text4 : t.text1, textDecoration: task.status === 'COMPLETED' ? 'line-through' : undefined }}>
                                            {task.title}
                                        </h3>
                                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded" style={{ ...getPriorityStyle(task.priority), borderRadius: 20 }}>
                                            {task.priority}
                                        </span>
                                        {task.isOverdue && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded" style={{ color: t.danger, background: t.dangerBg, border: `1px solid ${t.danger}30`, borderRadius: 20 }}>
                                                <Clock size={10}/> OVERDUE
                                            </span>
                                        )}
                                        {task.status !== 'PENDING' && (
                                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded" style={{
                                                borderRadius: 20,
                                                ...(task.status === 'COMPLETED'
                                                    ? { background: t.successBg, color: t.success, border: `1px solid ${t.success}40` }
                                                    : { background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}40` })
                                            }}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: t.text4 }}>
                                        {task.policyNumber && (
                                            <span className="flex items-center gap-1 font-medium px-1.5 py-0.5 rounded" style={{ color: t.accent, background: `${t.accent}18`, border: `1px solid ${t.accent}30` }}>
                                                <Briefcase size={12}/> {task.policyNumber}
                                            </span>
                                        )}
                                        {task.entityType === 'CLAIM' && (
                                            <span className="flex items-center gap-1 font-medium px-1.5 py-0.5 rounded" style={{ color: '#9333ea', background: '#9333ea18', border: '1px solid #9333ea30' }}>
                                                <AlertCircle size={12}/> Claim
                                            </span>
                                        )}
                                        {task.dueDate && (
                                            <span>Due: <span className="font-medium" style={{ color: task.isOverdue ? t.danger : t.text2 }}>{formatDate(task.dueDate)}</span></span>
                                        )}
                                        <span>Assigned by: {task.assignedByName || 'System'}</span>
                                    </div>
                                    {task.description && (
                                        <p className="text-sm mt-1 line-clamp-1" style={{ color: t.text3 }}>{task.description}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-center">
                                    <div className="transition-colors" style={{ color: t.text4 }}>
                                        {task.entityType === 'OTHER' || !task.entityType ? <MoreHorizontal size={20}/> : <ArrowRight size={20}/>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AssignTaskModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                preSelectedUser={user?.id}
            />

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    isOpen={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                />
            )}

            {selectedSlip && (
                <DetailModal
                    item={selectedSlip}
                    onClose={() => setSelectedSlip(null)}
                    onRefresh={refetch}
                    title="Slip Details"
                />
            )}
        </div>
    );
};

export default Agenda;
