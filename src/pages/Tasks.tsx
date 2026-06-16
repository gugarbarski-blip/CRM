import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Square, Trash2, Filter } from 'lucide-react';
import { taskStore, clientStore } from '../lib/store';
import type { Task, Client } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Filter = 'all' | 'pending' | 'completed' | 'overdue';

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');

  const load = async () => {
    try {
      const [t, c] = await Promise.all([taskStore.getAll(), clientStore.getAll()]);
      setTasks(t);
      setClients(c);
    } catch (err) {
      alert('Erro ao carregar tarefas: ' + (err as Error).message);
    }
  };

  useEffect(() => { load(); }, []);

  const now = new Date();

  const filtered = tasks.filter(t => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    if (filter === 'overdue') return !t.completed && t.due_date && new Date(t.due_date) < now;
    return true;
  }).sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const toggle = async (id: string, completed: boolean) => { await taskStore.update(id, { completed: !completed }); load(); };
  const remove = async (id: string) => { if (confirm('Excluir tarefa?')) { await taskStore.delete(id); load(); } };

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'overdue', label: 'Atrasadas' },
    { value: 'completed', label: 'Concluídas' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Tarefas</h2>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
            Nenhuma tarefa nesta categoria
          </div>
        )}
        {filtered.map(task => {
          const client = clientMap[task.client_id];
          const overdue = !task.completed && task.due_date && new Date(task.due_date) < now;
          return (
            <div key={task.id} className={`bg-white rounded-xl border flex items-start gap-3 p-4 ${overdue ? 'border-red-200' : 'border-gray-200'}`}>
              <button onClick={() => toggle(task.id, task.completed)} className="mt-0.5 flex-shrink-0">
                {task.completed ? <CheckSquare size={18} className="text-green-500" /> : <Square size={18} className="text-gray-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  {client && (
                    <Link to={`/clientes/${client.id}`} className="text-xs text-blue-600 hover:underline">{client.name}</Link>
                  )}
                  {task.due_date && (
                    <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {overdue && '⚠️ '}{format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(task.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
