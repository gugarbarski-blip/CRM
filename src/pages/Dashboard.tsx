import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, CheckSquare, Clock, TrendingUp } from 'lucide-react';
import { clientStore, taskStore, interactionStore } from '../lib/store';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const clients = clientStore.getAll();
  const tasks = taskStore.getAll();
  const interactions = interactionStore.getAll();

  const stats = useMemo(() => ({
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    pendingTasks: tasks.filter(t => !t.completed).length,
    overdueTasks: tasks.filter(t => !t.completed && new Date(t.due_date) < new Date()).length,
  }), [clients, tasks]);

  const recentInteractions = useMemo(() =>
    interactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  , [interactions]);

  const upcomingTasks = useMemo(() =>
    tasks
      .filter(t => !t.completed)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5)
  , [tasks]);

  const typeLabel: Record<string, string> = {
    call: '📞 Ligação', email: '📧 E-mail', meeting: '🤝 Reunião', note: '📝 Nota',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={20} />} label="Total de Clientes" value={stats.totalClients} color="blue" />
        <StatCard icon={<TrendingUp size={20} />} label="Clientes Ativos" value={stats.activeClients} color="green" />
        <StatCard icon={<CheckSquare size={20} />} label="Tarefas Pendentes" value={stats.pendingTasks} color="yellow" />
        <StatCard icon={<Clock size={20} />} label="Tarefas Atrasadas" value={stats.overdueTasks} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Próximas Tarefas</h3>
            <Link to="/tarefas" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
          </div>
          {upcomingTasks.length === 0 && <p className="text-gray-400 text-sm">Nenhuma tarefa pendente</p>}
          <div className="space-y-3">
            {upcomingTasks.map(task => {
              const client = clientStore.getById(task.client_id);
              const overdue = new Date(task.due_date) < new Date();
              return (
                <div key={task.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${overdue ? 'bg-red-500' : 'bg-blue-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{task.title}</p>
                    <p className="text-xs text-gray-500">{client?.name} · {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Interações Recentes</h3>
            <Link to="/clientes" className="text-sm text-blue-600 hover:underline">Ver clientes</Link>
          </div>
          {recentInteractions.length === 0 && <p className="text-gray-400 text-sm">Nenhuma interação registrada</p>}
          <div className="space-y-3">
            {recentInteractions.map(interaction => {
              const client = clientStore.getById(interaction.client_id);
              return (
                <div key={interaction.id} className="flex items-start gap-3">
                  <span className="text-base">{typeLabel[interaction.type]?.split(' ')[0]}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{client?.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{interaction.description}</p>
                    <p className="text-xs text-gray-400">{format(new Date(interaction.date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
