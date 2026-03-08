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

    const getPriorityColor = (p: string) => {
        switch(p) {
            case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
            case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'MEDIUM': return 'bg-blue-50 text-blue-700 border-blue-100';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
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
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-red-600 font-medium">Overdue</span>
                        <span className="text-sm font-bold text-red-800">{overdueCount}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-blue-600 font-medium">Pending</span>
                    <span className="text-sm font-bold text-blue-800">{pendingCount}</span>
                </div>
            </>
        );
        setHeaderActions(
            <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-all whitespace-nowrap"
            >
                <Plus size={16} /> New Task
            </button>
        );
        return () => { setHeaderActions(null); setHeaderLeft(null); };
    }, [overdueCount, pendingCount, setHeaderActions, setHeaderLeft]);

    // Filtered tasks with date filter
    const displayTasks = (tasks || [])
        .filter(t => {
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                if (!t.title.toLowerCase().includes(s) && !(t.policyNumber || '').toLowerCase().includes(s)) return false;
            }
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
            // Date filter on dueDate
            if (dateFrom || dateTo) {
                const due = t.dueDate ? t.dueDate.slice(0, 10) : '';
                if (dateFrom && due < toISODateString(dateFrom)!) return false;
                if (dateTo && due > toISODateString(dateTo)!) return false;
            }
            return true;
        });

    return (
        <div className="pb-20">
            {/* Sticky filter bar */}
            <div ref={filterRef} className="sticky top-0 z-30 bg-gray-50 sticky-filter-blur">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => handleStatusFilterChange(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
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
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                    >
                        <option value="all">All Priorities</option>
                        <option value="URGENT">Urgent</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>

                    {/* Date Filter */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '280px' }}>
                        <select disabled className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
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
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin text-blue-600' : ''} />
                    </button>
                </div>
            </div>
            </div>{/* end sticky filter bar */}

            {/* Task List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
                {isLoading ? (
                    <div className="p-12 text-center text-gray-500">Loading agenda...</div>
                ) : displayTasks.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <CheckCircle size={48} className="mb-4 text-green-100"/>
                        <p className="text-lg font-medium text-gray-600">All caught up!</p>
                        <p className="text-sm">No tasks found for the selected filter.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {displayTasks.map(task => (
                            <div 
                                key={task.id}
                                onClick={() => handleTaskClick(task)}
                                className="p-4 hover:bg-blue-50/50 transition-colors cursor-pointer group flex flex-col md:flex-row gap-4 items-start md:items-center relative"
                            >
                                {/* Priority Stripe */}
                                <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                                    task.priority === 'URGENT' ? 'bg-red-500' : 
                                    task.priority === 'HIGH' ? 'bg-orange-500' : 
                                    'bg-blue-300'
                                }`}></div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`font-bold text-gray-800 truncate ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : ''}`}>
                                            {task.title}
                                        </h3>
                                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded border ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                        {task.isOverdue && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                                <Clock size={10}/> OVERDUE
                                            </span>
                                        )}
                                        {task.status !== 'PENDING' && (
                                            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded border ${
                                                task.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                                            }`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                        {task.policyNumber && (
                                            <span className="flex items-center gap-1 text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                <Briefcase size={12}/> {task.policyNumber}
                                            </span>
                                        )}
                                        {task.entityType === 'CLAIM' && (
                                            <span className="flex items-center gap-1 text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                                <AlertCircle size={12}/> Claim
                                            </span>
                                        )}
                                        {task.dueDate && (
                                            <span>Due: <span className={`font-medium ${task.isOverdue ? 'text-red-600' : 'text-gray-700'}`}>{formatDate(task.dueDate)}</span></span>
                                        )}
                                        <span>Assigned by: {task.assignedByName || 'System'}</span>
                                    </div>
                                    {task.description && (
                                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">{task.description}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-center">
                                    <div className="text-gray-300 group-hover:text-blue-500 transition-colors">
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
