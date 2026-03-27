import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, Car, Wrench, Plus, Search,
  Trash2, DollarSign, Loader2, BarChart3,
  UserCircle, Briefcase
} from 'lucide-react';

// ---------------------------------------------------------------------------
// localStorage helpers (substitui Firebase)
// ---------------------------------------------------------------------------
const genId = () =>
  Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

function getCol<T>(name: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(`autopro_${name}`) ?? '[]') as T[];
  } catch {
    return [];
  }
}

function saveCol<T>(name: string, data: T[]) {
  localStorage.setItem(`autopro_${name}`, JSON.stringify(data));
}

function addItem<T extends object>(name: string, item: T): T & { id: string } {
  const col = getCol<T & { id: string }>(name);
  const newItem = { ...item, id: genId() };
  col.push(newItem);
  saveCol(name, col);
  return newItem;
}

function deleteItem(name: string, id: string) {
  const col = getCol<{ id: string }>(name).filter(i => i.id !== id);
  saveCol(name, col);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BaseItem { id: string; createdAt: string; }
interface Customer extends BaseItem { name: string; phone?: string; }
interface Vehicle  extends BaseItem { model: string; plate?: string; }
interface Staff    extends BaseItem { name: string; specialty?: string; }
interface Service  extends BaseItem {
  description: string;
  value: number;
  paymentMethod: string;
  staffName: string;
  status: string;
  date: string;
}

type TabName = 'dashboard' | 'services' | 'vehicles' | 'customers' | 'staff' | 'reports';
type ModalType = 'service' | 'vehicle' | 'customer' | 'staff';

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------
const getModalType = (tab: TabName): ModalType => {
  const map: Partial<Record<TabName, ModalType>> = {
    staff: 'staff', vehicles: 'vehicle', customers: 'customer',
  };
  return map[tab] ?? 'service';
};

const getAddLabel = (tab: TabName) => {
  const map: Partial<Record<TabName, string>> = {
    staff: 'Novo Mecânico', vehicles: 'Novo Veículo', customers: 'Novo Cliente',
  };
  return map[tab] ?? 'Nova OS';
};

const formatBRL = (val?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const App: React.FC = () => {
  const [role, setRole]           = useState<'admin' | 'funcionario'>('admin');
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [isSidebarOpen]           = useState(true);
  const [loading, setLoading]     = useState(true);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [services,  setServices]  = useState<Service[]>([]);
  const [staff,     setStaff]     = useState<Staff[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [modalType,  setModalType]  = useState<ModalType>('service');
  const [formData,   setFormData]   = useState<Record<string, string>>({
    paymentMethod: 'Dinheiro', staffName: '',
  });

  // Carrega dados do localStorage na inicialização
  useEffect(() => {
    setCustomers(getCol<Customer>('customers'));
    setVehicles(getCol<Vehicle>('vehicles'));
    setServices(getCol<Service>('services'));
    setStaff(getCol<Staff>('staff'));
    setLoading(false);
  }, []);

  const isAdmin = role === 'admin';

  // Relatórios
  const reportData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const calcStats = (list: Service[]) => {
      const total = list.reduce((acc, curr) => acc + (curr.value ?? 0), 0);
      const staffPerf = list.reduce<Record<string, { count: number; total: number }>>(
        (acc, curr) => {
          const name = curr.staffName || 'Não Atribuído';
          if (!acc[name]) acc[name] = { count: 0, total: 0 };
          acc[name].count += 1;
          acc[name].total += (curr.value ?? 0);
          return acc;
        },
        {}
      );
      return { count: list.length, total, staffPerf };
    };

    return {
      daily:   calcStats(services.filter(s => s.date === todayStr)),
      monthly: calcStats(services.filter(s => s.date?.substring(0, 7) === todayStr.substring(0, 7))),
    };
  }, [services]);

  // Salvar item
  const handleSave = () => {
    const colMap: Record<ModalType, string> = {
      customer: 'customers', vehicle: 'vehicles', staff: 'staff', service: 'services',
    };
    const colName = colMap[modalType];
    const base = { ...formData, createdAt: new Date().toISOString() };

    if (modalType === 'service') {
      const item = addItem<Omit<Service, 'id'>>(colName, {
        ...base,
        value:         parseFloat(formData.value ?? '0'),
        status:        'Pendente',
        date:          formData.date || new Date().toISOString().split('T')[0],
        description:   formData.description ?? '',
        paymentMethod: formData.paymentMethod ?? 'Dinheiro',
        staffName:     formData.staffName ?? '',
      } as Omit<Service, 'id'>);
      setServices(prev => [...prev, item as Service]);
    } else if (modalType === 'staff') {
      const item = addItem(colName, { name: formData.name ?? '', specialty: formData.specialty ?? '', createdAt: base.createdAt });
      setStaff(prev => [...prev, item as Staff]);
    } else if (modalType === 'vehicle') {
      const item = addItem(colName, { model: formData.model ?? '', plate: formData.plate ?? '', createdAt: base.createdAt });
      setVehicles(prev => [...prev, item as Vehicle]);
    } else {
      const item = addItem(colName, { name: formData.name ?? '', phone: formData.phone ?? '', createdAt: base.createdAt });
      setCustomers(prev => [...prev, item as Customer]);
    }

    setShowModal(false);
    setFormData({ paymentMethod: 'Dinheiro', staffName: '' });
  };

  // Deletar item
  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    const colMap: Record<TabName, string> = {
      services: 'services', staff: 'staff', vehicles: 'vehicles',
      customers: 'customers', dashboard: '', reports: '',
    };
    const col = colMap[activeTab];
    if (!col) return;
    deleteItem(col, id);
    if (activeTab === 'services')  setServices(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'staff')     setStaff(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'vehicles')  setVehicles(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'customers') setCustomers(prev => prev.filter(i => i.id !== id));
  };

  // Tabela dinâmica
  const getTableData = () => {
    if (activeTab === 'services')  return services  as BaseItem[];
    if (activeTab === 'staff')     return staff     as BaseItem[];
    if (activeTab === 'customers') return customers as BaseItem[];
    return vehicles as BaseItem[];
  };

  const getTableHeaders = () => {
    if (activeTab === 'staff')     return ['Nome Profissional', 'Especialidade', 'Admitido em'];
    if (activeTab === 'vehicles')  return ['Modelo', 'Placa', 'Cadastrado em'];
    if (activeTab === 'customers') return ['Nome do Cliente', 'Telefone', 'Cadastrado em'];
    return ['Serviço', 'Profissional', 'Pagamento'];
  };

  const getTableCells = (item: BaseItem) => {
    if (activeTab === 'staff') {
      const s = item as Staff;
      return [s.name, s.specialty || '-', s.createdAt?.substring(0, 10) || '-'];
    }
    if (activeTab === 'vehicles') {
      const v = item as Vehicle;
      return [v.model, v.plate || '-', v.createdAt?.substring(0, 10) || '-'];
    }
    if (activeTab === 'customers') {
      const c = item as Customer;
      return [c.name, c.phone || '-', c.createdAt?.substring(0, 10) || '-'];
    }
    const sv = item as Service;
    return [sv.description, sv.staffName || 'Nenhum', sv.paymentMethod || '-'];
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
      <Loader2 className="animate-spin" />
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 flex items-center space-x-3 border-b border-white/5">
          <div className="bg-blue-600 p-2 rounded-lg"><Wrench size={20} /></div>
          {isSidebarOpen && (
            <h1 className="text-lg font-black tracking-tight uppercase">
              Auto<span className="text-blue-500">Pro</span>
            </h1>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard"  active={activeTab} onClick={setActiveTab} open={isSidebarOpen} />
          <NavItem id="services"  icon={Wrench}          label="Serviços"   active={activeTab} onClick={setActiveTab} open={isSidebarOpen} />
          <NavItem id="vehicles"  icon={Car}             label="Veículos"   active={activeTab} onClick={setActiveTab} open={isSidebarOpen} />
          {isAdmin && <NavItem id="staff"     icon={Briefcase}     label="Equipa"     active={activeTab} onClick={setActiveTab} open={isSidebarOpen} />}
          {isAdmin && <NavItem id="customers" icon={Users}         label="Clientes"   active={activeTab} onClick={setActiveTab} open={isSidebarOpen} />}
          {isAdmin && <NavItem id="reports"   icon={BarChart3}     label="Relatórios" active={activeTab} onClick={setActiveTab} open={isSidebarOpen} />}
        </nav>

        {/* Switcher ADM / FUNC */}
        <div className="p-4 bg-white/5 m-4 rounded-xl border border-white/5">
          <div className="flex bg-slate-950 p-1 rounded-lg">
            <button
              onClick={() => setRole('admin')}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded-md ${role === 'admin' ? 'bg-blue-600' : 'text-slate-500'}`}
            >ADM</button>
            <button
              onClick={() => {
                setRole('funcionario');
                if (['customers', 'reports', 'staff'].includes(activeTab)) setActiveTab('dashboard');
              }}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded-md ${role === 'funcionario' ? 'bg-amber-600' : 'text-slate-500'}`}
            >FUNC</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-1">Sistema de Gestão</h2>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight capitalize">{activeTab}</h1>
          </div>
          {!['dashboard', 'reports'].includes(activeTab) && (
            <button
              onClick={() => { setModalType(getModalType(activeTab)); setShowModal(true); }}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-lg hover:bg-blue-700 transition-all"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">{getAddLabel(activeTab)}</span>
            </button>
          )}
        </header>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatBox title="Faturamento Hoje"     value={isAdmin ? formatBRL(reportData.daily.total) : '---'} icon={DollarSign}  color="text-emerald-500" />
              <StatBox title="Serviços Hoje"        value={String(reportData.daily.count)}                      icon={Wrench}      color="text-blue-500"   />
              <StatBox title="Profissionais Ativos" value={String(staff.length)}                                icon={UserCircle}  color="text-purple-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Equipa */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black mb-6">Equipa em Campo</h3>
                <div className="space-y-4">
                  {staff.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <div className="bg-white p-2 rounded-full border border-slate-100 text-slate-400"><UserCircle size={20} /></div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{s.specialty || 'Mecânico Geral'}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase">Ativo</span>
                    </div>
                  ))}
                  {staff.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum profissional cadastrado.</p>}
                </div>
              </div>

              {/* Últimas atribuições */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black mb-6">Últimas Atribuições</h3>
                <div className="space-y-4">
                  {services.slice(-4).reverse().map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-l-4 border-blue-500">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{s.description}</p>
                        <p className="text-[10px] text-slate-500 font-bold flex items-center mt-1">
                          <UserCircle size={12} className="mr-1" /> {s.staffName || 'Pendente'}
                        </p>
                      </div>
                      <span className="font-black text-slate-400 text-xs">{s.date}</span>
                    </div>
                  ))}
                  {services.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum serviço registado.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Relatórios */}
        {activeTab === 'reports' && isAdmin && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
              <StatBox title="Faturamento Mensal" value={formatBRL(reportData.monthly.total)} icon={DollarSign} color="text-emerald-500" />
              <StatBox title="Serviços no Mês"   value={String(reportData.monthly.count)}    icon={Wrench}     color="text-blue-500"   />
            </div>
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black mb-6 flex items-center space-x-2 text-blue-600">
                <Briefcase size={20} />
                <span>Produtividade da Equipa (Mensal)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4">Profissional</th>
                      <th className="pb-4">Qtd. Serviços</th>
                      <th className="pb-4 text-right">Total Gerado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {Object.entries(reportData.monthly.staffPerf).map(([name, stats]) => (
                      <tr key={name}>
                        <td className="py-4 font-bold text-slate-700">{name}</td>
                        <td className="py-4 text-sm font-medium text-slate-500">{stats.count} serviços</td>
                        <td className="py-4 text-right font-black text-slate-800">{formatBRL(stats.total)}</td>
                      </tr>
                    ))}
                    {Object.keys(reportData.monthly.staffPerf).length === 0 && (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400 text-sm">Sem dados este mês.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tabela genérica */}
        {(['services', 'staff', 'vehicles', 'customers'] as TabName[]).includes(activeTab) && (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center bg-slate-50/50">
              <Search className="text-slate-300 mr-3" />
              <input
                placeholder="Procurar na base..."
                className="bg-transparent outline-none w-full font-medium"
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  {getTableHeaders().map((h, i) => (
                    <th key={i} className="p-6">{h}</th>
                  ))}
                  <th className="p-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {getTableData()
                  .filter(i => JSON.stringify(i).toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(item => {
                    const cells = getTableCells(item);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        {cells.map((cell, i) => (
                          <td key={i} className={`p-6 text-sm ${i === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>{cell}</td>
                        ))}
                        <td className="p-6 text-right">
                          <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {getTableData().length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-400 text-sm">Nenhum registo encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[40px] p-10 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-black mb-8">
              {modalType === 'staff'    ? 'Novo Profissional'
               : modalType === 'vehicle'  ? 'Novo Veículo'
               : modalType === 'customer' ? 'Novo Cliente'
               : 'Novo Serviço'}
            </h2>

            <div className="space-y-4">
              {modalType === 'staff' && (
                <>
                  <input placeholder="Nome do Mecânico" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                  <input placeholder="Especialidade (Ex: Suspensão, Motor)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, specialty: e.target.value}))} />
                </>
              )}

              {modalType === 'vehicle' && (
                <>
                  <input placeholder="Modelo do Veículo (Ex: Civic 2022)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, model: e.target.value}))} />
                  <input placeholder="Placa (Ex: ABC-1234)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, plate: e.target.value}))} />
                </>
              )}

              {modalType === 'customer' && (
                <>
                  <input placeholder="Nome do Cliente" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                  <input placeholder="Telefone (Ex: 11 99999-9999)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, phone: e.target.value}))} />
                </>
              )}

              {modalType === 'service' && (
                <>
                  <input placeholder="Descrição do Serviço" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, description: e.target.value}))} />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Valor (BRL)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" onChange={e => setFormData(f => ({...f, value: e.target.value}))} />
                    <select className="p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-500" onChange={e => setFormData(f => ({...f, paymentMethod: e.target.value}))}>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Pix">Pix</option>
                      <option value="Cartão">Cartão</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Profissional Responsável</p>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" onChange={e => setFormData(f => ({...f, staffName: e.target.value}))}>
                      <option value="">Selecione o mecânico...</option>
                      {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="flex space-x-4 pt-4 border-t">
                <button onClick={() => setShowModal(false)} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                <button onClick={handleSave} className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
interface NavItemProps {
  id: TabName; icon: React.ElementType<any>; label: string;
  active: TabName; onClick: (id: TabName) => void; open: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, active, onClick, open }) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${active === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
  >
    <Icon size={18} />
    {open && <span className="text-xs font-bold">{label}</span>}
  </button>
);

interface StatBoxProps {
  title: string; value: string; icon: React.ElementType<any>; color: string;
}

const StatBox: React.FC<StatBoxProps> = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
    <div className={`p-3 rounded-xl bg-slate-50 ${color}`}><Icon size={20} /></div>
  </div>
);

export default App;
