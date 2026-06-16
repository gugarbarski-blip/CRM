import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckSquare, Square, Phone, Mail, Building2 } from 'lucide-react';
import { clientStore, taskStore, interactionStore } from '../lib/store';
import type { Client, Task, Interaction } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const INTERACTION_TYPES: { value: Interaction['type']; label: string; emoji: string }[] = [
  { value: 'call', label: 'Ligação', emoji: '📞' },
  { value: 'email', label: 'E-mail', emoji: '📧' },
  { value: 'meeting', label: 'Reunião', emoji: '🤝' },
  { value: 'note', label: 'Nota', emoji: '📝' },
];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [tab, setTab] = useState<'tasks' | 'history'>('tasks');

  // new task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  // new interaction form
  const [intType, setIntType] = useState<Interaction['type']>('call');
  const [intDesc, setIntDesc] = useState('');
  const [intDate, setIntDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(() => {
    if (!id) return;
    setClient(clientStore.getById(id) || null);
    setTasks(taskStore.getByClient(id));
    setInteractions(interactionStore.getByClient(id));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !id) return;
    taskStore.create({ client_id: id, title: taskTitle, description: taskDesc, due_date: taskDue, completed: false });
    setTaskTitle(''); setTaskDue(''); setTaskDesc('');
    load();
  };

  const toggleTask = (taskId: string, completed: boolean) => {
    taskStore.update(taskId, { completed: !completed });
    load();
  };

  const deleteTask = (taskId: string) => {
    taskStore.delete(taskId);
    load();
  };

  const addInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intDesc.trim() || !id) return;
    interactionStore.create({ client_id: id, type: intType, description: intDesc, date: intDate });
    setIntDesc('');
    load();
  };

  if (!client) return <div className="text-gray-400">Cliente não encontrado.</div>;

  const statusColor: Record<Client['status'], string> = {
    lead: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
  };
  const statusLabel = { lead: 'Lead', active: 'Ativo', inactive: 'Inativo' };

  return (
    <div>
      <Link to="/clientes" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Voltar para Clientes
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{client.name}</h2>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[client.status]}`}>
              {statusLabel[client.status]}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          {client.company && <span className="flex items-center gap-1"><Building2 size={14} />{client.company}</span>}
          {client.email && <span className="flex items-center gap-1"><Mail size={14} />{client.email}</span>}
          {client.phone && <span className="flex items-center gap-1"><Phone size={14} />{client.phone}</span>}
        </div>
        {client.notes && <p className="mt-4 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{client.notes}</p>}
      </div>

      <div className="flex gap-2 mb-4">
        <TabBtn active={tab === 'tasks'} onClick={() => setTab('tasks')}>Tarefas ({tasks.filter(t => !t.completed).length})</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Histórico ({interactions.length})</TabBtn>
      </div>

      {tab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Nova Tarefa</h3>
            <form onSubmit={addTask} className="space-y-3">
              <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Título da tarefa *" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={taskDue} onChange={e => setTaskDue(e.target.value)} type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Descrição (opcional)" rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus size={14} /> Adicionar
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Tarefas</h3>
            {tasks.length === 0 && <p className="text-gray-400 text-sm">Nenhuma tarefa ainda</p>}
            <div className="space-y-2">
              {tasks.map(task => {
                const overdue = !task.completed && task.due_date && new Date(task.due_date) < new Date();
                return (
                  <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg ${task.completed ? 'bg-gray-50' : 'bg-white border border-gray-100'}`}>
                    <button onClick={() => toggleTask(task.id, task.completed)} className="mt-0.5 flex-shrink-0">
                      {task.completed ? <CheckSquare size={16} className="text-green-500" /> : <Square size={16} className="text-gray-400" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                      {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                      {task.due_date && (
                        <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {overdue && '⚠️ '}{format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Registrar Interação</h3>
            <form onSubmit={addInteraction} className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {INTERACTION_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setIntType(t.value)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${intType === t.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <input type="date" value={intDate} onChange={e => setIntDate(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea value={intDesc} onChange={e => setIntDesc(e.target.value)} placeholder="Descreva a interação *" rows={3} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus size={14} /> Registrar
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Histórico</h3>
            {interactions.length === 0 && <p className="text-gray-400 text-sm">Nenhuma interação registrada</p>}
            <div className="space-y-3">
              {interactions.map(i => {
                const t = INTERACTION_TYPES.find(t => t.value === i.type);
                return (
                  <div key={i.id} className="flex gap-3">
                    <span className="text-xl flex-shrink-0">{t?.emoji}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-medium text-gray-500">{t?.label} · {format(new Date(i.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        <button onClick={() => { interactionStore.delete(i.id); load(); }} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{i.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${active ? 'bg-white border border-gray-200 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
      {children}
    </button>
  );
}
