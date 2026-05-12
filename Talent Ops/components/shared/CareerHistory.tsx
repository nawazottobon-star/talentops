import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Briefcase, Calendar, Check, X, MoreVertical, Edit2, Trash2, Star, Code, GraduationCap, AlertCircle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { supabase } from '../../lib/supabaseClient';

type Position = {
  id: string;
  title: string;
  department: string;
  employmentType: string;
  startDate: string; // yyyy-MM-dd
  endDate?: string | null;
  isCurrent: boolean;
};

export interface CareerHistoryRef {
  openModal: () => void;
}

export interface CareerHistoryProps {
  employeeId?: string;
}

export const CareerHistory = forwardRef<CareerHistoryRef, CareerHistoryProps>(({ employeeId }, ref) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [globalDepartment, setGlobalDepartment] = useState('Engineering');
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const [formData, setFormData] = useState({
    title: '',
    department: '',
    employmentType: 'Full Time',
    startDate: '',
    isCurrent: false,
  });

  const handleOpenModal = () => setIsModalOpen(true);

  useImperativeHandle(ref, () => ({
    openModal: handleOpenModal
  }));

  const fetchTimeline = async () => {
    if (!employeeId) {
      setPositions([]);
      return;
    }

    setFetching(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          job_title, 
          join_date, 
          departments ( name )
        `)
        .eq('id', employeeId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn("Profiles fetch issue:", profileError);
      }

      const deptName = (profile?.departments as any)?.name || 'Engineering';
      setGlobalDepartment(deptName);

      const { data: history, error: historyError } = await supabase
        .from('career_history')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (historyError) {
        console.warn("Career history fetch issue:", historyError);
      }

      const mappedPositions: Position[] = [];

      if (profile && profile.job_title) {
        mappedPositions.push({
          id: 'current-profile-role',
          title: profile.job_title,
          department: deptName,
          employmentType: 'Full Time',
          startDate: profile.join_date || format(new Date(), 'yyyy-MM-dd'),
          isCurrent: true,
        });
      }

      if (history) {
        history.forEach((h: any) => {
          mappedPositions.push({
            id: h.id,
            title: h.role || h.title || h.job_title || 'Role',
            department: deptName,
            employmentType: h.employment_type || 'Full Time',
            startDate: h.start_date,
            endDate: h.end_date,
            isCurrent: h.is_current === true || !h.end_date
          });
        });
      }

      mappedPositions.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

      // Safety Fallback: Ensure at least the top-most position behaves as 'current' 
      // if database strictly lacked an explicit 'isCurrent'/open end-date.
      if (mappedPositions.length > 0 && !mappedPositions.some(p => p.isCurrent)) {
        mappedPositions[0].isCurrent = true;
      }

      setPositions(mappedPositions);

    } catch (err) {
      console.error('Error fetching career journey:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ title: '', department: '', employmentType: 'Full Time', startDate: '', isCurrent: false });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;

    try {
      const dbPayload = {
        employee_id: employeeId,
        role: formData.title,
        employment_type: formData.employmentType,
        start_date: formData.startDate,
        end_date: formData.isCurrent ? null : format(new Date(), 'yyyy-MM-dd'),
        is_current: formData.isCurrent
      };

      const { error } = await supabase.from('career_history').insert(dbPayload);
      if (error) throw error;

      if (formData.isCurrent) {
        await supabase.from('profiles').update({
          job_title: formData.title
        }).eq('id', employeeId);
      }

      handleCloseModal();
      fetchTimeline();

    } catch (err) {
      console.error("Failed to insert position:", err);
      alert("Error adding position. Check required columns in Supabase.");
    }
  };

  const handleDeletePosition = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'current-profile-role') {
      alert("You cannot delete the active role directly from here. Please use the HR console to change base profiles.");
      return;
    }

    setConfirmModal({
      show: true,
      title: 'Delete Position',
      message: 'Are you sure you want to delete this position permanently? This will remove it from your career timeline.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('career_history').delete().eq('id', id);
          if (error) throw error;
          setPositions(prev => prev.filter(p => p.id !== id));
        } catch (err) {
          console.error("Failed to delete", err);
          alert("Failed to delete position.");
        }
      }
    });
  };

  const handleEditPosition = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'current-profile-role') {
      alert("Edit base profile through the HR console.");
      return;
    }
    alert(`Edit functionality for ID ${id} is coming soon!`);
  };

  const calculateDurationInDays = (start: string, end?: string | null) => {
    if (!start) return '0d';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const days = differenceInDays(endDate, startDate);
    return `${Math.max(0, days)}d`;
  };

  const getRoleIcon = (title: string, isCurrent: boolean) => {
    if (!title) return <Briefcase size={20} className={isCurrent ? "text-blue-600" : "text-gray-500"} />;
    if (isCurrent) return <Star size={20} className="fill-blue-600 text-blue-600" />;

    const titleLower = title.toLowerCase();
    if (titleLower.includes('intern')) return <GraduationCap size={20} className="text-gray-500" />;
    if (titleLower.includes('developer') || titleLower.includes('engineering') || titleLower.includes('software')) return <Code size={20} className="text-gray-500" />;

    return <Briefcase size={20} className="text-gray-500" />;
  };

  const TimelineNode = ({ isCurrent }: { isCurrent: boolean }) => {
    if (isCurrent) {
      return (
        <div className="relative z-10 flex shrink-0 items-center justify-center w-[16px] h-[16px] bg-blue-500 rounded-full mt-2.5 animate-custom-pulse">
          <div className="w-[6px] h-[6px] bg-white rounded-full"></div>
        </div>
      );
    }
    return (
      <div className="relative z-10 flex shrink-0 items-center justify-center w-[16px] h-[16px] bg-blue-500 rounded-full mt-2.5 text-white">
        <Check size={10} strokeWidth={4} />
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes customPulse {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          70% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
        .animate-custom-pulse {
          animation: customPulse 1.8s infinite;
        }
      `}</style>

      <div className="w-full flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-white">
          <h2 className="text-[17px] font-semibold text-gray-900">Career Journey</h2>
          <span className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1 rounded-md border border-gray-200">
            {positions.length} Milestones
          </span>
        </div>

        {/* Timeline Layout */}
        <div className="p-6">
          {fetching ? (
            <div className="flex justify-center items-center h-32 text-gray-400 font-medium">Loading career data...</div>
          ) : positions.length === 0 ? (
            <div className="flex justify-center items-center h-32 text-gray-400 font-medium">No career history records found.</div>
          ) : (
            <div className="flex flex-col space-y-6">
              {positions.map((role, index) => {
                const isLast = index === positions.length - 1;
                return (
                  <div key={role.id} className="relative flex items-stretch group">

                    {!isLast && (
                      <div className="absolute left-[15px] top-[16px] -bottom-[42px] w-[2px] bg-blue-400 z-0"></div>
                    )}

                    <div className="relative flex flex-col items-center justify-start w-8 shrink-0 mr-4 z-10">
                      <TimelineNode isCurrent={role.isCurrent} />
                    </div>

                    <div
                      onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}
                      className={`flex-1 rounded-xl border p-4 transition-all w-full cursor-pointer hover:shadow-md ${role.isCurrent
                          ? 'bg-[#EFF6FF] border-blue-500 shadow-sm'
                          : 'bg-white border-gray-200'
                        }`}
                    >
                      <div className="flex items-start gap-4">

                        <div className={`w-12 h-12 flex-shrink-0 rounded-[14px] flex items-center justify-center ${role.isCurrent
                            ? 'bg-[#DBEAFE] text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                          }`}>
                          {getRoleIcon(role.title, role.isCurrent)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-3">
                            <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">
                              {role.title} <span className="font-normal text-gray-500 ml-1">({role.employmentType})</span>
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                              {role.isCurrent && (
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium tracking-widest uppercase">
                                  CURRENT
                                </span>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger className="p-1 -mr-1 -mt-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors outline-none focus:ring-2 focus:ring-blue-500">
                                  <MoreVertical size={16} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-xl rounded-xl p-1.5 z-50">
                                  <DropdownMenuItem onClick={(e) => handleEditPosition(role.id, e as any)} className="flex items-center gap-2 px-2.5 py-1.5 outline-none rounded-md cursor-pointer hover:bg-gray-50 transition-colors text-gray-700 text-sm font-medium">
                                    <Edit2 size={14} className="text-gray-400" /> Edit Position
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => handleDeletePosition(role.id, e as any)} className="flex items-center gap-2 px-2.5 py-1.5 outline-none rounded-md cursor-pointer hover:bg-red-50 transition-colors text-red-600 text-sm font-medium">
                                    <Trash2 size={14} className="text-red-500" /> Delete Position
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 mt-1.5 text-[13px] text-gray-500 font-medium">
                            <span className="truncate">{role.department}</span>
                            <div className="w-1 h-1 rounded-full bg-gray-300 shrink-0"></div>
                            <span className="shrink-0">{calculateDurationInDays(role.startDate, role.endDate)}</span>
                          </div>

                          {expandedId === role.id && (
                            <div className="mt-3 pt-3 border-t border-gray-200/60 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Start Date</span>
                                  <span className="font-semibold text-gray-800">{role.startDate ? format(new Date(role.startDate), 'MMMM d, yyyy') : 'Unknown'}</span>
                                </div>
                                <div>
                                  <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">End Date</span>
                                  <span className="font-semibold text-gray-800">{role.isCurrent || !role.endDate ? 'Current Role' : format(new Date(role.endDate), 'MMMM d, yyyy')}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-lg font-semibold text-gray-900">Add Position</h3>
                <button onClick={handleCloseModal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
                  <input type="text" name="title" required value={formData.title} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-normal" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Employment Type</label>
                  <select name="employmentType" required value={formData.employmentType} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-normal">
                    <option value="Full Time">Full Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                  <input type="date" name="startDate" required max={format(new Date(), 'yyyy-MM-dd')} value={formData.startDate} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-normal" />
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group w-max">
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <input type="checkbox" name="isCurrent" checked={formData.isCurrent} onChange={handleInputChange} className="peer sr-only" />
                      <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors"></div>
                      <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">This is the current role</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                  <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save Position</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Premium Confirmation Modal */}
      {confirmModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '32px', 
            borderRadius: '24px', 
            width: '400px', 
            maxWidth: '90%', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '20px', 
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>{confirmModal.title}</h3>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.5', marginBottom: '32px' }}>{confirmModal.message}</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                style={{
                  flex: 1,
                  padding: '14px', 
                  borderRadius: '14px', 
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0', 
                  cursor: 'pointer', 
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, show: false });
                }}
                style={{
                  flex: 1,
                  padding: '14px', 
                  borderRadius: '14px',
                  backgroundColor: '#ef4444',
                  color: 'white', 
                  border: 'none', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
