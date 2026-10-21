import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../utils/api';
import { openWhatsAppFoodReminder } from '../utils/whatsapp';
import { exportToPdf } from '../utils/exportPdf';
import Pagination from '../components/Pagination';
import { useToast } from '../context/ToastContext';
import {
  Utensils,
  Calendar,
  Clock,
  Phone,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  MessageCircle,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  User,
  RotateCw,
  Sparkles,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Layers
} from 'lucide-react';

export default function FoodSchedulePage() {
  const { toast } = useToast();
  const [duties, setDuties] = useState([]);
  const [todayDuties, setTodayDuties] = useState([]);
  const [tomorrowDuties, setTomorrowDuties] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // All, Pending, Completed, Swapped, Cancelled
  const [dateFilter, setDateFilter] = useState('upcoming'); // all, upcoming, today, thisWeek, thisMonth

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDuty, setEditingDuty] = useState(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapDuty1, setSwapDuty1] = useState(null);
  const [swapDuty2Id, setSwapDuty2Id] = useState('');
  const [swapAreaFilter, setSwapAreaFilter] = useState('All');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Single Add / Edit Form State
  const initialForm = {
    memberId: '',
    customName: '',
    phone: '',
    division: '',
    date: new Date().toISOString().split('T')[0],
    mealType: 'All Day',
    status: 'Pending',
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Auto-generate Rotation Form
  const [generateMode, setGenerateMode] = useState('byArea'); // 'byArea' or 'all'
  const [orderedAreas, setOrderedAreas] = useState([]);
  const [selectedAreaNames, setSelectedAreaNames] = useState([]);
  const [expandedAreas, setExpandedAreas] = useState({});
  const [generateForm, setGenerateForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    mealType: 'All Day',
    selectedMemberIds: [],
  });

  // Fetch duties and members
  const fetchDuties = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/food-duties', {
        search,
        division: divisionFilter !== 'All' ? divisionFilter : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
      });

      if (res.success) {
        setDuties(res.duties || []);
        setTodayDuties(res.todayDuties || []);
        setTomorrowDuties(res.tomorrowDuties || []);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to fetch food duties');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/members');
      if (res.success) {
        setMembers(res.members || []);
      }
    } catch (err) {
      console.error('Failed to load members for food rotation:', err);
    }
  };

  useEffect(() => {
    fetchDuties();
  }, [search, divisionFilter, statusFilter]);

  useEffect(() => {
    fetchMembers();
  }, []);

  // Compute unique divisions from members and duties
  const uniqueDivisions = useMemo(() => {
    const set = new Set();
    members.forEach(m => {
      if (m.division && m.division.trim()) set.add(m.division.trim());
    });
    duties.forEach(d => {
      if (d.division && d.division.trim()) set.add(d.division.trim());
      if (d.member?.division) set.add(d.member.division.trim());
    });
    return Array.from(set).sort();
  }, [members, duties]);

  // Date filtering logic
  const filteredDuties = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return duties.filter(d => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);

      if (dateFilter === 'upcoming') {
        return dDate >= today;
      }
      if (dateFilter === 'today') {
        return dDate.getTime() === today.getTime();
      }
      if (dateFilter === 'thisWeek') {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return dDate >= today && dDate <= nextWeek;
      }
      if (dateFilter === 'thisMonth') {
        return dDate.getMonth() === today.getMonth() && dDate.getFullYear() === today.getFullYear();
      }
      return true; // 'all'
    });
  }, [duties, dateFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, divisionFilter, statusFilter, dateFilter]);

  const paginatedDuties = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredDuties.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredDuties, currentPage]);

  // Handlers for Add/Edit
  const handleOpenAdd = () => {
    setEditingDuty(null);
    setFormData(initialForm);
    setShowAddModal(true);
  };

  const handleOpenEdit = (duty) => {
    setEditingDuty(duty);
    setFormData({
      memberId: duty.memberId ? String(duty.memberId) : '',
      customName: duty.customName || '',
      phone: duty.phone || '',
      division: duty.division || '',
      date: new Date(duty.date).toISOString().split('T')[0],
      mealType: duty.mealType || 'All Day',
      status: duty.status || 'Pending',
      notes: duty.notes || '',
    });
    setShowAddModal(true);
  };

  const handleMemberSelect = (mId) => {
    if (!mId) {
      setFormData(prev => ({ ...prev, memberId: '' }));
      return;
    }
    const m = members.find(x => x.id === parseInt(mId));
    if (m) {
      setFormData(prev => ({
        ...prev,
        memberId: String(m.id),
        customName: m.name,
        phone: m.phone || '',
        division: m.division || '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingDuty) {
        await api.put(`/api/food-duties/${editingDuty.id}`, formData);
        toast.success('Food duty turn updated successfully');
      } else {
        await api.post('/api/food-duties', formData);
        toast.success('Food duty scheduled successfully');
      }
      setShowAddModal(false);
      fetchDuties();
    } catch (err) {
      toast.error(err.message || 'Failed to save food duty');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this food duty turn?')) return;
    try {
      await api.del(`/api/food-duties/${id}`);
      toast.success('Food duty entry removed');
      fetchDuties();
    } catch (err) {
      toast.error(err.message || 'Failed to delete food duty');
    }
  };

  // Status Quick Update
  const handleStatusChange = async (duty, newStatus) => {
    try {
      await api.put(`/api/food-duties/${duty.id}`, { status: newStatus });
      toast.success(`Turn marked as ${newStatus}`);
      fetchDuties();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Swap Handlers
  const handleOpenSwap = (duty) => {
    setSwapDuty1(duty);
    setSwapDuty2Id('');
    setShowSwapModal(true);
  };

  const handleExecuteSwap = async (e) => {
    e.preventDefault();
    if (!swapDuty1 || !swapDuty2Id) {
      toast.error('Please choose another member to swap dates with');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/api/food-duties/swap', {
        dutyId1: swapDuty1.id,
        dutyId2: parseInt(swapDuty2Id)
      });
      toast.success(res.message || 'Dates swapped successfully!');
      setShowSwapModal(false);
      fetchDuties();
    } catch (err) {
      toast.error(err.message || 'Failed to swap duty dates');
    } finally {
      setSubmitting(false);
    }
  };

  // Group active members by Area / Division
  const memberAreas = useMemo(() => {
    const map = {};
    members.filter(m => m.status === 'Active').forEach(m => {
      const area = (m.division && m.division.trim()) || 'General / Area';
      if (!map[area]) map[area] = [];
      map[area].push(m);
    });
    return map;
  }, [members]);

  // Auto-Generate Roster Handlers
  const handleOpenGenerate = () => {
    const activeMembers = members.filter(m => m.status === 'Active');
    const areaNames = Object.keys(memberAreas);
    setOrderedAreas(areaNames);
    setSelectedAreaNames(areaNames);
    setGenerateMode('byArea');
    setExpandedAreas({});
    setGenerateForm({
      startDate: new Date().toISOString().split('T')[0],
      mealType: 'All Day',
      selectedMemberIds: activeMembers.map(m => m.id),
    });
    setShowGenerateModal(true);
  };

  const moveAreaUp = (index) => {
    if (index <= 0) return;
    const next = [...orderedAreas];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setOrderedAreas(next);
  };

  const moveAreaDown = (index) => {
    if (index >= orderedAreas.length - 1) return;
    const next = [...orderedAreas];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setOrderedAreas(next);
  };

  const swapTwoAreas = (area1, area2) => {
    const idx1 = orderedAreas.indexOf(area1);
    const idx2 = orderedAreas.indexOf(area2);
    if (idx1 === -1 || idx2 === -1) return;
    const next = [...orderedAreas];
    next[idx1] = area2;
    next[idx2] = area1;
    setOrderedAreas(next);
  };

  const toggleAreaSelection = (areaName) => {
    const isSelected = selectedAreaNames.includes(areaName);
    const nextSelected = isSelected
      ? selectedAreaNames.filter(a => a !== areaName)
      : [...selectedAreaNames, areaName];
    setSelectedAreaNames(nextSelected);

    const areaHouses = memberAreas[areaName] || [];
    const houseIds = areaHouses.map(h => h.id);
    if (isSelected) {
      setGenerateForm(prev => ({
        ...prev,
        selectedMemberIds: prev.selectedMemberIds.filter(id => !houseIds.includes(id))
      }));
    } else {
      setGenerateForm(prev => ({
        ...prev,
        selectedMemberIds: Array.from(new Set([...prev.selectedMemberIds, ...houseIds]))
      }));
    }
  };

  const handleGenerateRoster = async (e) => {
    e.preventDefault();
    const { startDate, mealType, selectedMemberIds } = generateForm;

    let finalOrderedMemberIds = [];

    if (generateMode === 'byArea') {
      // Rotate consecutively area by area according to orderedAreas
      for (const area of orderedAreas) {
        if (!selectedAreaNames.includes(area)) continue;
        const areaHouses = (memberAreas[area] || []).filter(m => selectedMemberIds.includes(m.id));
        finalOrderedMemberIds.push(...areaHouses.map(m => m.id));
      }
    } else {
      finalOrderedMemberIds = members
        .filter(m => m.status === 'Active' && selectedMemberIds.includes(m.id))
        .map(m => m.id);
    }

    if (finalOrderedMemberIds.length === 0) {
      toast.error('Please select at least one house/member for the rotation roster');
      return;
    }

    setSubmitting(true);
    try {
      const start = new Date(startDate);
      const bulkAssignments = finalOrderedMemberIds.map((mId, index) => {
        const d = new Date(start);
        d.setDate(d.getDate() + index);
        const m = members.find(x => x.id === mId);
        return {
          memberId: mId,
          customName: m ? m.name : null,
          phone: m ? m.phone : null,
          division: m ? m.division : null,
          date: d.toISOString().split('T')[0],
          mealType: mealType || 'All Day',
          status: 'Pending',
        };
      });

      await api.post('/api/food-duties', { bulkAssignments });
      toast.success(`Successfully generated rotation roster for ${bulkAssignments.length} days!`);
      setShowGenerateModal(false);
      fetchDuties();
    } catch (err) {
      toast.error(err.message || 'Failed to generate roster');
    } finally {
      setSubmitting(false);
    }
  };

  // Export PDF of Duty Schedule
  const handleExportPdf = () => {
    const columns = ['Date & Day', 'House / Member', 'Division / Area', 'Meal', 'Phone', 'Status', 'Notes'];
    const rows = filteredDuties.map(d => [
      new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
      d.member ? (d.member.idNumber ? `[#${d.member.idNumber}] ${d.member.name}` : d.member.name) : (d.customName || 'Unassigned'),
      d.division || d.member?.division || '-',
      d.mealType || 'All Day',
      d.phone || d.member?.phone || '-',
      d.status || 'Pending',
      d.notes || '-'
    ]);

    exportToPdf({
      title: "Usthad's Food Duty Schedule (ഭക്ഷണപ്പടി)",
      subtitle: `sirajul huda sangam chulliyode • Total Scheduled: ${filteredDuties.length}`,
      dateRange: dateFilter.toUpperCase(),
      columns,
      rows,
      fileName: 'Usthads_Food_Duty_Schedule.pdf'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Swapped':
        return 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Cancelled':
        return 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            Usthad's Food Duty (ഭക്ഷണപ്പടി)
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold">
              {duties.length} Scheduled
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daily meal turn rotation for Usthad (ഉസ്താദിന്റെ ഭക്ഷണപ്പടി). See today's & tomorrow's house, reschedule or swap turns, and send 1-click WhatsApp alerts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPdf}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
            title="Download PDF Roster"
          >
            <Download className="w-4 h-4 text-rose-600" />
            <span className="hidden sm:inline">PDF Roster</span>
          </button>
          <button
            onClick={handleOpenGenerate}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition-transform active:scale-95"
            title="Auto-generate rotation roster from members"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Roster</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Turn</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SPOTLIGHT CARDS: Today's House & Tomorrow's House         */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's House Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-5 sm:p-6 shadow-xl shadow-emerald-900/10">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between pb-3 border-b border-white/20">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white text-emerald-900 shadow-xs">
                TODAY'S MEAL • ഇന്നത്തെ ഉസ്താദിന്റെ ഭക്ഷണം
              </span>
              <span className="text-xs font-semibold text-emerald-100">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </div>
            <Utensils className="w-5 h-5 text-emerald-200" />
          </div>

          <div className="pt-4 space-y-3">
            {todayDuties.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm font-semibold text-emerald-100">No house scheduled for today yet.</p>
                <button
                  onClick={handleOpenAdd}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-emerald-800 text-xs font-bold shadow-md hover:bg-emerald-50 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Assign Today's House
                </button>
              </div>
            ) : (
              todayDuties.map(td => {
                const memberName = td.member?.name || td.customName || 'Assigned House';
                const division = td.division || td.member?.division;
                const phone = td.phone || td.member?.phone;
                const idNum = td.member?.idNumber;
                const isCompleted = td.status === 'Completed';

                return (
                  <div key={td.id} className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {idNum && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-emerald-900">
                              #{idNum}
                            </span>
                          )}
                          <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                            {memberName}
                          </h3>
                        </div>
                        <div className="text-xs text-emerald-100 flex flex-wrap items-center gap-2 mt-1">
                          {division && (
                            <span className="inline-flex items-center gap-1">
                              <Building className="w-3 h-3 opacity-80" />
                              {division}
                            </span>
                          )}
                          {phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3 opacity-80" />
                              {phone}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                            {td.mealType || 'All Day'}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-1 rounded-xl text-xs font-bold ${
                        isCompleted ? 'bg-emerald-300 text-emerald-950' : 'bg-amber-300 text-amber-950'
                      }`}>
                        {td.status}
                      </span>
                    </div>

                    {/* Action buttons on card */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openWhatsAppFoodReminder(td)}
                        className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold shadow-md transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Send WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(td, isCompleted ? 'Pending' : 'Completed')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          isCompleted
                            ? 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                            : 'bg-emerald-400 hover:bg-emerald-300 text-emerald-950 border-emerald-300'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isCompleted ? 'Completed ✓' : 'Mark Done'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenSwap(td)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition-all"
                        title="Swap with another date"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Swap Turn</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tomorrow's House Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white p-5 sm:p-6 shadow-xl shadow-blue-900/10">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between pb-3 border-b border-white/20">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white text-blue-900 shadow-xs">
                TOMORROW'S MEAL • നാളത്തെ ഉസ്താദിന്റെ ഭക്ഷണം
              </span>
              <span className="text-xs font-semibold text-blue-100">
                {new Date(Date.now() + 86400000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </div>
            <Clock className="w-5 h-5 text-blue-200" />
          </div>

          <div className="pt-4 space-y-3">
            {tomorrowDuties.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm font-semibold text-blue-100">No house scheduled for tomorrow yet.</p>
                <button
                  onClick={handleOpenAdd}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-blue-900 text-xs font-bold shadow-md hover:bg-blue-50 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Assign Tomorrow's House
                </button>
              </div>
            ) : (
              tomorrowDuties.map(td => {
                const memberName = td.member?.name || td.customName || 'Assigned House';
                const division = td.division || td.member?.division;
                const phone = td.phone || td.member?.phone;
                const idNum = td.member?.idNumber;

                return (
                  <div key={td.id} className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {idNum && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-blue-900">
                              #{idNum}
                            </span>
                          )}
                          <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                            {memberName}
                          </h3>
                        </div>
                        <div className="text-xs text-blue-100 flex flex-wrap items-center gap-2 mt-1">
                          {division && (
                            <span className="inline-flex items-center gap-1">
                              <Building className="w-3 h-3 opacity-80" />
                              {division}
                            </span>
                          )}
                          {phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3 opacity-80" />
                              {phone}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                            {td.mealType || 'All Day'}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-1 rounded-xl text-xs font-bold bg-blue-300 text-blue-950">
                        {td.status}
                      </span>
                    </div>

                    {/* Action buttons on card */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openWhatsAppFoodReminder(td)}
                        className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50 text-xs font-bold shadow-md transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Remind for Tomorrow</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenSwap(td)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold transition-all"
                        title="Swap with another date"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Swap Turn</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FILTER AND SEARCH BAR                                     */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by house name, phone, division..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Division Filter */}
          <div>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Divisions / Areas</option>
              {uniqueDivisions.map((div, i) => (
                <option key={i} value={div}>{div}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="upcoming">All Upcoming Turns</option>
              <option value="today">Today Only</option>
              <option value="thisWeek">This Week (Next 7 Days)</option>
              <option value="thisMonth">This Month</option>
              <option value="all">All Records (incl. Past)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Swapped">Swapped</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE VIEW: Compact Cards                                */}
      {/* ======================================================== */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading food schedule...
          </div>
        ) : filteredDuties.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-xs">
            No meal duty turns found matching your filter criteria.
          </div>
        ) : (
          <>
            {paginatedDuties.map((d) => {
              const name = d.member?.name || d.customName || 'House';
              const division = d.division || d.member?.division;
              const phone = d.phone || d.member?.phone;
              const idNum = d.member?.idNumber;
              const dDate = new Date(d.date);
              const isToday = new Date().toDateString() === dDate.toDateString();

              return (
                <div
                  key={d.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-xs space-y-3 ${
                    isToday ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80 dark:border-slate-800/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white">
                            Today
                          </span>
                        )}
                        {idNum && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300">
                            #{idNum}
                          </span>
                        )}
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {name}
                        </h4>
                      </div>

                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          🗓️ {dDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {division && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px]">
                            <Building className="w-2.5 h-2.5" />
                            {division}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(d.status)}`}>
                      {d.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Meal Time</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{d.mealType || 'All Day'}</span>
                    </div>
                    {phone && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-400 block font-semibold">Phone</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{phone}</span>
                      </div>
                    )}
                  </div>

                  {d.notes && (
                    <div className="text-[11px] text-slate-500 italic bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/40 dark:border-amber-900/40">
                      Note: {d.notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 gap-1">
                    <button
                      type="button"
                      onClick={() => openWhatsAppFoodReminder(d)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenSwap(d)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg text-xs font-semibold flex items-center gap-1 border border-blue-200 dark:border-blue-900/60"
                        title="Swap date with another house"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Swap</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(d)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                        title="Edit date / details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                        title="Delete duty"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredDuties.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* ======================================================== */}
      {/* DESKTOP VIEW: Structured Table                            */}
      {/* ======================================================== */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Date & Day</th>
                <th className="py-3.5 px-4">House / Member</th>
                <th className="py-3.5 px-4">Division / Area</th>
                <th className="py-3.5 px-4">Meal</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">WhatsApp</th>
                <th className="py-3.5 px-4 text-center">Swap Turn</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading food duty schedule...
                  </td>
                </tr>
              ) : filteredDuties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No food duty records found. Click "+ Add Turn" or "Generate Roster" to schedule.
                  </td>
                </tr>
              ) : (
                paginatedDuties.map((d) => {
                  const name = d.member?.name || d.customName || 'House';
                  const division = d.division || d.member?.division;
                  const phone = d.phone || d.member?.phone;
                  const idNum = d.member?.idNumber;
                  const dDate = new Date(d.date);
                  const isToday = new Date().toDateString() === dDate.toDateString();

                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                        isToday ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-600 text-white">
                              Today
                            </span>
                          )}
                          <span className="font-bold text-slate-900 dark:text-white">
                            {dDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          {dDate.toLocaleDateString('en-GB', { weekday: 'long' })}
                        </span>
                      </td>

                      {/* Member / House */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {idNum && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300">
                              #{idNum}
                            </span>
                          )}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {name}
                          </span>
                        </div>
                        {phone && <div className="text-[11px] text-slate-400 mt-0.5">📞 {phone}</div>}
                        {d.notes && <div className="text-[10px] text-amber-600 italic mt-0.5">Note: {d.notes}</div>}
                      </td>

                      {/* Division */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {division ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg text-xs font-medium">
                            <Building className="w-3 h-3" />
                            {division}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Meal Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {d.mealType || 'All Day'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={d.status}
                          onChange={(e) => handleStatusChange(d, e.target.value)}
                          className={`px-2 py-1 text-xs font-bold rounded-lg border focus:outline-none cursor-pointer ${getStatusBadge(d.status)}`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                          <option value="Swapped">Swapped</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>

                      {/* WhatsApp Reminder Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openWhatsAppFoodReminder(d)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                          title="Send Food Duty Reminder via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Remind</span>
                        </button>
                      </td>

                      {/* Swap Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenSwap(d)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-200 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors shadow-xs"
                          title="Move or swap this turn with another date"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Swap</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(d)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                            title="Edit Date or Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredDuties.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          className="p-4"
        />
      </div>

      {/* ======================================================== */}
      {/* MODALS                                                    */}
      {/* ======================================================== */}

      {/* Add / Edit Duty Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 flex items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full my-2 sm:my-auto border border-slate-200 dark:border-slate-800 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingDuty ? 'Edit Food Duty Turn' : 'Schedule New Food Duty Turn'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                {/* Select Registered Member / House */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Select Registered Member (House)
                  </label>
                  <select
                    value={formData.memberId}
                    onChange={(e) => handleMemberSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Member or Enter Custom House below --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.idNumber ? `[#${m.idNumber}] ` : ''}{m.name} {m.division ? `(${m.division})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Or Custom Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      House / Member Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Al-Bait House"
                      value={formData.customName}
                      onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Phone (WhatsApp)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9845012345"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Division & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Division / Area
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ward 2, Chulliyode"
                      value={formData.division}
                      onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Duty Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Meal Type & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Meal Type
                    </label>
                    <select
                      value={formData.mealType}
                      onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="All Day">All Day (മുഴുവൻ ഭക്ഷണം)</option>
                      <option value="Breakfast">Breakfast (പ്രഭാതഭക്ഷണം)</option>
                      <option value="Lunch">Lunch (ഉച്ചഭക്ഷണം)</option>
                      <option value="Dinner">Dinner (അത്താഴം)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Swapped">Swapped</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Special Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Vegetarian preference, delivery to mosque by 12:30 PM..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Saving...' : editingDuty ? 'Update Turn' : 'Schedule Turn'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Swap Dates Modal */}
      {showSwapModal && swapDuty1 && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 flex items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full my-2 sm:my-auto border border-slate-200 dark:border-slate-800 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Swap Food Duty Turn (തീയതി പരസ്പരം മാറ്റുക)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSwapModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSwap} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 text-xs space-y-1">
                  <span className="font-bold text-blue-900 dark:text-blue-300 block uppercase">
                    Member 1 (Requesting Swap):
                  </span>
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {swapDuty1.member?.name || swapDuty1.customName}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Current Date: <span className="font-bold">{new Date(swapDuty1.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Area: <span className="font-semibold">{swapDuty1.division || swapDuty1.member?.division || 'General'}</span>
                  </p>
                </div>

                {/* Filter target by Area to easily swap across or within specific areas */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
                      Filter Target by Area / Division
                    </label>
                    {swapAreaFilter && (
                      <button
                        type="button"
                        onClick={() => setSwapAreaFilter('')}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Show All
                      </button>
                    )}
                  </div>
                  <select
                    value={swapAreaFilter}
                    onChange={(e) => setSwapAreaFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">All Areas ({duties.filter(d => d.id !== swapDuty1.id).length} available turns)</option>
                    {memberAreas.map(a => (
                      <option key={a.name} value={a.name}>
                        {a.name} ({duties.filter(d => d.id !== swapDuty1.id && (d.division || d.member?.division || 'General') === a.name).length} turns)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Select Member 2 to Swap Dates With <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={swapDuty2Id}
                    onChange={(e) => setSwapDuty2Id(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- Choose scheduled member to swap with --</option>
                    {duties
                      .filter(d => d.id !== swapDuty1.id && (!swapAreaFilter || (d.division || d.member?.division || 'General') === swapAreaFilter))
                      .map(d => {
                        const dName = d.member?.name || d.customName || 'House';
                        const dateStr = new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                        const areaStr = d.division || d.member?.division || 'General';
                        return (
                          <option key={d.id} value={d.id}>
                            {dateStr} — {dName} [{areaStr}]
                          </option>
                        );
                      })}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    💡 Both members' dates will be exchanged instantly, and marked with 'Swapped' status. You can swap within the same area or across any other area.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
                <button
                  type="button"
                  onClick={() => setShowSwapModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !swapDuty2Id}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {submitting ? 'Swapping...' : 'Confirm Swap'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Auto-Generate Rotation Modal */}
      {showGenerateModal && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 flex items-center justify-center animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full my-2 sm:my-auto border border-slate-200 dark:border-slate-800 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Auto-Generate Daily Food Rotation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateRoster} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automatically create consecutive daily food duties for mosque staff. Choose whether to generate sequentially area-by-area or by custom individual houses.
                </p>

                {/* Mode Selector */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setGenerateMode('area')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      generateMode === 'area'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    By Area / Division (ഏരിയ ക്രമം)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerateMode('individual')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      generateMode === 'individual'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Individual Selection
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Rotation Starting Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={generateForm.startDate}
                      onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                      Meal Type
                    </label>
                    <select
                      value={generateForm.mealType}
                      onChange={(e) => setGenerateForm({ ...generateForm, mealType: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="All Day">All Day (മുഴുവൻ ഭക്ഷണം)</option>
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                    </select>
                  </div>
                </div>

                {generateMode === 'area' ? (
                  /* ================= Area by Area Mode ================= */
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase block">
                          Area Rotation Order ({orderedAreas.filter(a => selectedAreaNames.includes(a.name)).length} areas selected)
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Roster starts from Area #1, finishes all its houses, then moves to Area #2, etc. Use ↑ / ↓ or Swap to change sequence.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedAreaNames(orderedAreas.map(a => a.name))}
                          className="text-[11px] text-blue-600 font-semibold hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedAreaNames([])}
                          className="text-[11px] text-slate-400 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto p-1">
                      {orderedAreas.map((area, idx) => {
                        const isSelected = selectedAreaNames.includes(area.name);
                        const isExpanded = !!expandedAreas[area.name];
                        return (
                          <div
                            key={area.name}
                            className={`rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800 shadow-xs'
                                : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60'
                            }`}
                          >
                            <div className="p-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleAreaSelection(area.name)}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 shrink-0"
                                />
                                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block truncate">
                                    {area.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {area.members.length} {area.members.length === 1 ? 'house' : 'houses'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Up / Down Order Buttons */}
                                <button
                                  type="button"
                                  onClick={() => moveAreaUp(idx)}
                                  disabled={idx === 0}
                                  title="Move Earlier in Roster"
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveAreaDown(idx)}
                                  disabled={idx === orderedAreas.length - 1}
                                  title="Move Later in Roster"
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>

                                {/* Swap with dropdown */}
                                <select
                                  aria-label="Swap with another area"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      swapTwoAreas(area.name, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  defaultValue=""
                                  className="text-[10px] py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                  <option value="" disabled>Swap...</option>
                                  {orderedAreas.filter(o => o.name !== area.name).map(o => (
                                    <option key={o.name} value={o.name}>Swap with {o.name}</option>
                                  ))}
                                </select>

                                {/* Expand houses toggle */}
                                <button
                                  type="button"
                                  onClick={() => setExpandedAreas({ ...expandedAreas, [area.name]: !isExpanded })}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            </div>

                            {/* Houses in this area */}
                            {isExpanded && (
                              <div className="px-3 pb-2.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30">
                                <span className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase">
                                  Houses in {area.name}:
                                </span>
                                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                                  {area.members.map(m => (
                                    <div key={m.id} className="truncate">
                                      • {m.name} {m.idNumber && <span className="text-slate-400 font-mono">#{m.idNumber}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ================= Individual Mode ================= */
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                        Select Houses in Rotation ({generateForm.selectedMemberIds.length} days):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setGenerateForm({ ...generateForm, selectedMemberIds: members.map(m => m.id) })}
                          className="text-[11px] text-blue-600 font-semibold hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenerateForm({ ...generateForm, selectedMemberIds: [] })}
                          className="text-[11px] text-slate-400 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 p-1">
                      {members.map(m => {
                        const isChecked = generateForm.selectedMemberIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-all ${
                              isChecked
                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...generateForm.selectedMemberIds, m.id]
                                    : generateForm.selectedMemberIds.filter(id => id !== m.id);
                                  setGenerateForm({ ...generateForm, selectedMemberIds: next });
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className="font-semibold">{m.name}</span>
                              {m.idNumber && <span className="font-mono text-[10px] text-slate-400">#{m.idNumber}</span>}
                            </div>
                            {m.division && <span className="text-[10px] opacity-75">{m.division}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (generateMode === 'area'
                      ? selectedAreaNames.length === 0
                      : generateForm.selectedMemberIds.length === 0)
                  }
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md disabled:opacity-50 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  {submitting
                    ? 'Generating...'
                    : generateMode === 'area'
                    ? `Generate Roster (${orderedAreas.filter(a => selectedAreaNames.includes(a.name)).reduce((sum, a) => sum + a.members.length, 0)} Days)`
                    : `Generate Roster (${generateForm.selectedMemberIds.length} Days)`}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
