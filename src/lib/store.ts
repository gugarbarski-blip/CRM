import type { Client, Task, Interaction } from '../types';

const STORAGE_KEYS = {
  clients: 'crm_clients',
  tasks: 'crm_tasks',
  interactions: 'crm_interactions',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Clients
export const clientStore = {
  getAll: (): Client[] => load<Client>(STORAGE_KEYS.clients),
  getById: (id: string): Client | undefined => load<Client>(STORAGE_KEYS.clients).find(c => c.id === id),
  create: (data: Omit<Client, 'id' | 'created_at'>): Client => {
    const clients = load<Client>(STORAGE_KEYS.clients);
    const client: Client = { ...data, id: generateId(), created_at: new Date().toISOString() };
    save(STORAGE_KEYS.clients, [...clients, client]);
    return client;
  },
  update: (id: string, data: Partial<Client>): Client | null => {
    const clients = load<Client>(STORAGE_KEYS.clients);
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) return null;
    clients[idx] = { ...clients[idx], ...data };
    save(STORAGE_KEYS.clients, clients);
    return clients[idx];
  },
  delete: (id: string) => {
    save(STORAGE_KEYS.clients, load<Client>(STORAGE_KEYS.clients).filter(c => c.id !== id));
  },
};

// Tasks
export const taskStore = {
  getAll: (): Task[] => load<Task>(STORAGE_KEYS.tasks),
  getByClient: (clientId: string): Task[] => load<Task>(STORAGE_KEYS.tasks).filter(t => t.client_id === clientId),
  create: (data: Omit<Task, 'id' | 'created_at'>): Task => {
    const tasks = load<Task>(STORAGE_KEYS.tasks);
    const task: Task = { ...data, id: generateId(), created_at: new Date().toISOString() };
    save(STORAGE_KEYS.tasks, [...tasks, task]);
    return task;
  },
  update: (id: string, data: Partial<Task>): Task | null => {
    const tasks = load<Task>(STORAGE_KEYS.tasks);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...data };
    save(STORAGE_KEYS.tasks, tasks);
    return tasks[idx];
  },
  delete: (id: string) => {
    save(STORAGE_KEYS.tasks, load<Task>(STORAGE_KEYS.tasks).filter(t => t.id !== id));
  },
};

// Interactions
export const interactionStore = {
  getAll: (): Interaction[] => load<Interaction>(STORAGE_KEYS.interactions),
  getByClient: (clientId: string): Interaction[] =>
    load<Interaction>(STORAGE_KEYS.interactions)
      .filter(i => i.client_id === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  create: (data: Omit<Interaction, 'id' | 'created_at'>): Interaction => {
    const interactions = load<Interaction>(STORAGE_KEYS.interactions);
    const interaction: Interaction = { ...data, id: generateId(), created_at: new Date().toISOString() };
    save(STORAGE_KEYS.interactions, [...interactions, interaction]);
    return interaction;
  },
  delete: (id: string) => {
    save(STORAGE_KEYS.interactions, load<Interaction>(STORAGE_KEYS.interactions).filter(i => i.id !== id));
  },
};
