import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { clientStore } from '../lib/store';
import type { Client } from '../types';

interface Props {
  client: Client | null;
  onSave: () => void;
  onClose: () => void;
}

const empty = { name: '', email: '', phone: '', company: '', status: 'lead' as Client['status'], notes: '' };

export default function ClientModal({ client, onSave, onClose }: Props) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (client) {
      setForm({ name: client.name, email: client.email, phone: client.phone, company: client.company, status: client.status, notes: client.notes });
    } else {
      setForm(empty);
    }
  }, [client]);

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      if (client) {
        await clientStore.update(client.id, form);
      } else {
        await clientStore.create(form);
      }
      onSave();
    } catch (err) {
      alert('Erro ao salvar cliente: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{client ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Nome *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
          <Field label="E-mail" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
          <Field label="Telefone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Empresa" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="lead">Lead</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
