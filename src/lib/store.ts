import { supabase } from './supabase';
import type { Client, Task, Interaction } from '../types';

// Convert empty strings to null for nullable date columns
function nullifyDate(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}

// Clients
export const clientStore = {
  getAll: async (): Promise<Client[]> => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  getById: async (id: string): Promise<Client | null> => {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  create: async (data: Omit<Client, 'id' | 'created_at'>): Promise<Client> => {
    const { data: created, error } = await supabase.from('clients').insert(data).select().single();
    if (error) throw error;
    return created;
  },
  update: async (id: string, data: Partial<Client>): Promise<Client | null> => {
    const { data: updated, error } = await supabase.from('clients').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  },
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },
};

// Tasks
export const taskStore = {
  getAll: async (): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  getByClient: async (clientId: string): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  create: async (data: Omit<Task, 'id' | 'created_at'>): Promise<Task> => {
    const payload = { ...data, due_date: nullifyDate(data.due_date) };
    const { data: created, error } = await supabase.from('tasks').insert(payload).select().single();
    if (error) throw error;
    return created;
  },
  update: async (id: string, data: Partial<Task>): Promise<Task | null> => {
    const payload = 'due_date' in data ? { ...data, due_date: nullifyDate(data.due_date) } : data;
    const { data: updated, error } = await supabase.from('tasks').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  },
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
};

// Interactions
export const interactionStore = {
  getAll: async (): Promise<Interaction[]> => {
    const { data, error } = await supabase.from('interactions').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  getByClient: async (clientId: string): Promise<Interaction[]> => {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  create: async (data: Omit<Interaction, 'id' | 'created_at'>): Promise<Interaction> => {
    const { data: created, error } = await supabase.from('interactions').insert(data).select().single();
    if (error) throw error;
    return created;
  },
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('interactions').delete().eq('id', id);
    if (error) throw error;
  },
};
