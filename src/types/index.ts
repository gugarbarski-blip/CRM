export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'lead' | 'active' | 'inactive';
  created_at: string;
  notes: string;
}

export interface Task {
  id: string;
  client_id: string;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
  created_at: string;
}

export interface Interaction {
  id: string;
  client_id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  description: string;
  date: string;
  created_at: string;
}
