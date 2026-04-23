
import { useState, useEffect } from "react";
import { ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Bell,
  Calendar as CalendarIcon,
 } from 'lucide-react';
import { Card, CardContent} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { RouterOutputs } from "@/types";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface Appointment {
  id: number;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  prospectName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  location?: string | null;
  agentName?: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | null;
  color?: string;
  tenantId?: number;
  prospectId?: number | null;
  agentId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CalendarDay {
  date: Date;
  appointments: Appointment[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

// ============================================
// CALENDAR VIEW
// ============================================

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [_selectedDate, _setSelectedDate] = useState<Date | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    prospectId: "",
    prospectName: "",
    prospectEmail: "",
    location: "",
    notes: "",
  });

  // Fetch appointments
  const { data: appointmentsData } = trpc.business.appointment.list.useQuery({});
  const { data: prospectsDataRaw } = trpc.business.prospect.list.useQuery({});
  
  const prospectsData = prospectsDataRaw as RouterOutputs["prospect"]["list"];

  useEffect(() => {
    // ✅ FIX: prospectsData et appointmentsData sont paginés (PaginatedResponse<T>)
    if (appointmentsData?.data) {
      setAppointments(
        
        appointmentsData.data.map((apt: RouterOutputs["appointment"]["list"]["data"][number]) => ({
          id: apt.id,
          title: apt.title,
          description: apt.description,
          startTime: new Date(apt.startTime),
          endTime: new Date(apt.endTime),
          prospectName: apt.prospectName || "Prospect",
          prospectEmail: apt.prospectEmail,
          location: apt.location,
          agentName: apt.agentName || "Agent",
          status: apt.status || "scheduled",
          color: "primary",
        }))
      );
    }
  }, [appointmentsData]);

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const firstDay = firstDayOfMonth(currentDate);
    const totalDays = daysInMonth(currentDate);
    const today = new Date();

    // Previous month days
    const prevMonthDays = daysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        prevMonthDays - i
      );
      days.push({
        date,
        appointments: [],
        isToday: false,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const dayAppointments = appointments.filter(
        (apt) =>
          apt.startTime.getDate() === i &&
          apt.startTime.getMonth() === currentDate.getMonth() &&
          apt.startTime.getFullYear() === currentDate.getFullYear()
      );

      days.push({
        date,
        appointments: dayAppointments,
        isToday:
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear(),
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
      days.push({
        date,
        appointments: [],
        isToday: false,
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const utils = trpc.useUtils();

  const createAppointmentMutation = trpc.business.appointment.create.useMutation({
    onSuccess: () => {
      toast.success("Rendez-vous créé avec succès");
      setIsDialogOpen(false);
      setNewAppointment({
        title: "",
        description: "",
        startTime: "",
        endTime: "",
        prospectId: "",
        prospectName: "",
        prospectEmail: "",
        location: "",
        notes: "",
      });
      // Refresh calendar
      
      utils.business.appointment.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Erreur lors de la création : ${error.message}`);
    }
  });

  const handleAddAppointment = async () => {
    if (!newAppointment.title || !newAppointment.startTime || !newAppointment.endTime) {
      toast.error("Veuillez remplir les champs obligatoires (Titre, Début, Fin)");
      return;
    }

    try {
      await createAppointmentMutation.mutateAsync({
        title: newAppointment.title,
        description: `${newAppointment.description}\n\nNotes: ${newAppointment.notes}`,
        startTime: new Date(newAppointment.startTime),
        endTime: new Date(newAppointment.endTime),
        location: newAppointment.location,
        prospectId: newAppointment.prospectId ? parseInt(newAppointment.prospectId) : undefined,
      });
    } catch (err: any) {
      // L'erreur est déjà gérée par onError
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8" data-main-content>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Calendrier des Rendez-vous</h1>
        <p className="text-slate-400">Gestion des rendez-vous et synchronisation Google/Outlook</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="text-white" size={24} />
          </button>
          <h2 className="text-2xl font-bold text-white min-w-48 text-center">
            {currentDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className="text-white" size={24} />
          </button>
        </div>

        <div className="flex gap-2">
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === mode
                  ? "bg-primary text-white shadow-lg shadow-primary/50"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {mode === "month" ? "Mois" : mode === "week" ? "Semaine" : "Jour"}
            </button>
          ))}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <Plus size={20} />
              Nouveau Rendez-vous
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Créer un rendez-vous</DialogTitle>
              <DialogDescription className="text-slate-400">
                Ajouter un nouveau rendez-vous au calendrier
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Titre du rendez-vous *</label>
                <Input
                  placeholder="Ex: Présentation produit"
                  value={newAppointment.title}
                  onChange={(e: any) =>
                    setNewAppointment({ ...newAppointment, title: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Sélectionner un Prospect</label>
                <select
                  className="w-full h-10 px-3 rounded-md bg-slate-700 border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newAppointment.prospectId}
                  onChange={(e: any) => {
                    // ✅ FIX: Accès sécurisé à prospectsData.data
                    const prospectList = Array.isArray(prospectsData?.data) ? prospectsData.data : (Array.isArray(prospectsData) ? prospectsData : []);
                    const prospect = prospectList?.find((p: any) => p.id.toString() === e.target.value);
                    setNewAppointment({ 
                      ...newAppointment, 
                      prospectId: e.target.value,
                      prospectName: prospect?.name || "",
                      prospectEmail: prospect?.email || ""
                    });
                  }}
                >
                  <option value="">-- Choisir un prospect --</option>
                  {/* ✅ FIX: Itération sur prospectsData.data */}
                  {(Array.isArray(prospectsData?.data) ? prospectsData.data : (Array.isArray(prospectsData) ? prospectsData : []))?.map((p: any) => (
                    <option key={p.id as string} value={p.id as string}>{p.name as string} ({p.email as string})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Début *</label>
                  <Input
                    type="datetime-local"
                    value={newAppointment.startTime}
                    onChange={(e: any) =>
                      setNewAppointment({ ...newAppointment, startTime: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Fin *</label>
                  <Input
                    type="datetime-local"
                    value={newAppointment.endTime}
                    onChange={(e: any) =>
                      setNewAppointment({ ...newAppointment, endTime: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Lieu</label>
                <Input
                  placeholder="Ex: Bureau, Google Meet..."
                  value={newAppointment.location}
                  onChange={(e: any) =>
                    setNewAppointment({ ...newAppointment, location: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Notes</label>
                <Textarea
                  placeholder="Notes additionnelles..."
                  value={newAppointment.notes}
                  onChange={(e: any) =>
                    setNewAppointment({ ...newAppointment, notes: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddAppointment}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Créer le rendez-vous
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Calendar Grid */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-800/80">
          {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
            <div key={day} className="py-4 text-center text-sm font-bold text-slate-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => (
            <div
              key={idx}
              className={`min-h-[140px] p-2 border-r border-b border-slate-700 transition-colors ${
                !day.isCurrentMonth ? "bg-slate-900/30 opacity-40" : "hover:bg-slate-700/30"
              } ${day.isToday ? "bg-primary/5" : ""}`}
            >
              <div className="flex justify-between items-center mb-2">
                <span
                  className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                    day.isToday ? "bg-primary text-white shadow-lg shadow-primary/50" : "text-slate-300"
                  }`}
                >
                  {day.date.getDate()}
                </span>
                {day.appointments.length > 0 && (
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-[10px]">
                    {day.appointments.length} rdv
                  </Badge>
                )}
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[100px] scrollbar-hide">
                {day.appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-1.5 rounded bg-primary/20 border-l-2 border-primary text-[10px] text-slate-200 cursor-pointer hover:bg-primary/30 transition-all truncate"
                    title={`${apt.title} - ${apt.prospectName}`}
                  >
                    <div className="font-bold truncate">{apt.title}</div>
                    <div className="opacity-70 flex items-center gap-1">
                      <Clock size={8} />
                      {apt.startTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend / Info */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <CalendarIcon className="text-blue-500" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total ce mois</p>
              <p className="text-2xl font-bold text-white">{appointments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <Bell className="text-green-500" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Rappels envoyés</p>
              <p className="text-2xl font-bold text-white">
                {appointments.filter(a => a.status === "confirmed").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <User className="text-purple-500" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Prospects engagés</p>
              <p className="text-2xl font-bold text-white">
                {new Set(appointments.map(a => a.prospectId)).size}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CalendarView;