import { NavLink, Outlet } from 'react-router-dom';
import { Users, CheckSquare, LayoutDashboard, Radar } from 'lucide-react';

export default function Layout() {
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col p-4 gap-1">
        <div className="mb-6 px-2">
          <h1 className="text-xl font-bold text-gray-900">CRM</h1>
          <p className="text-xs text-gray-500">Gestão de Clientes</p>
        </div>
        <NavLink to="/" end className={navClass}>
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>
        <NavLink to="/clientes" className={navClass}>
          <Users size={16} /> Clientes
        </NavLink>
        <NavLink to="/tarefas" className={navClass}>
          <CheckSquare size={16} /> Tarefas
        </NavLink>
        <NavLink to="/radar" className={navClass}>
          <Radar size={16} /> Radar
        </NavLink>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
