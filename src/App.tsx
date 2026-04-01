import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, Car, Wrench, Plus, Search,
  Trash2, DollarSign, Loader2, BarChart3,
  UserCircle, Briefcase, Menu, X, Lock, Eye, EyeOff, KeyRound, LogOut,
  CheckCircle, Clock, CreditCard, FileText, PlusCircle, MinusCircle, Printer,
  ThumbsUp, ThumbsDown
} from 'lucide-react';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const genId = () =>
  Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

function getCol<T>(name: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(`autopro_${name}`) ?? '[]') as T[];
  } catch { return []; }
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
// Auth helpers
// ---------------------------------------------------------------------------
const AUTH_KEY  = 'autopro_auth';
const PWD_KEY   = 'autopro_admin_pwd';
const DEFAULT_PWD = 'admin123';

const getStoredPwd  = () => localStorage.getItem(PWD_KEY) || DEFAULT_PWD;
const isAuthValid   = () => sessionStorage.getItem(AUTH_KEY) === 'true';
const setAuthValid  = (v: boolean) =>
  v ? sessionStorage.setItem(AUTH_KEY, 'true') : sessionStorage.removeItem(AUTH_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BaseItem { id: string; createdAt: string; }
interface Customer extends BaseItem { name: string; phone?: string; }
interface Vehicle  extends BaseItem { model: string; plate?: string; }
interface Staff    extends BaseItem { name: string; specialty?: string; }
interface Service  extends BaseItem {
  description: string; value: number; paymentMethod: string;
  staffName: string; status: string; date: string;
  clientName: string; plate: string;
}
interface QuoteItem { description: string; qty: number; unitValue: number; }
interface Quote extends BaseItem {
  clientName: string; vehicleModel: string; vehiclePlate: string;
  items: QuoteItem[]; total: number;
  status: 'Pendente' | 'Aprovado' | 'Recusado';
}

type TabName   = 'dashboard' | 'services' | 'vehicles' | 'customers' | 'staff' | 'reports' | 'quotes';
type ModalType = 'service' | 'vehicle' | 'customer' | 'staff' | 'quote';

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const getModalType = (tab: TabName): ModalType => {
  const map: Partial<Record<TabName, ModalType>> = {
    staff: 'staff', vehicles: 'vehicle', customers: 'customer', quotes: 'quote',
  };
  return map[tab] ?? 'service';
};
const getAddLabel = (tab: TabName) => {
  const map: Partial<Record<TabName, string>> = {
    staff: 'Novo Mecânico', vehicles: 'Novo Veículo', customers: 'Novo Cliente', quotes: 'Novo Orçamento',
  };
  return map[tab] ?? 'Nova OS';
};
const formatBRL = (val?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const App: React.FC = () => {
  // ── Auth state ──
  const [isAuthenticated, setIsAuthenticated] = useState(isAuthValid);
  const [showChangePwd,   setShowChangePwd]    = useState(false);
  const [pwdInput,        setPwdInput]         = useState('');
  const [pwdVisible,      setPwdVisible]       = useState(false);
  const [pwdError,        setPwdError]         = useState('');
  const [newPwd,          setNewPwd]           = useState('');
  const [confirmPwd,      setConfirmPwd]       = useState('');
  const [newPwdVisible,   setNewPwdVisible]    = useState(false);

  // ── App state ──
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
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

  // ── Entrega de serviço ──
  const [showDeliveryModal,   setShowDeliveryModal]   = useState(false);
  const [deliveryServiceId,   setDeliveryServiceId]   = useState<string | null>(null);
  const [deliveryPayment,     setDeliveryPayment]     = useState('Dinheiro');

  // ── Orçamentos ──
  const [quotes,        setQuotes]        = useState<Quote[]>([]);
  const [quoteClient,   setQuoteClient]   = useState('');
  const [quoteVehicle,  setQuoteVehicle]  = useState('');
  const [quotePlate,    setQuotePlate]    = useState('');
  const [quoteItems,    setQuoteItems]    = useState<QuoteItem[]>([{ description: '', qty: 1, unitValue: 0 }]);

  useEffect(() => {
    setCustomers(getCol<Customer>('customers'));
    setVehicles(getCol<Vehicle>('vehicles'));
    setServices(getCol<Service>('services'));
    setStaff(getCol<Staff>('staff'));
    setQuotes(getCol<Quote>('quotes'));
    setLoading(false);
  }, []);

  // ── Auth actions ──
  const handleAdminLogin = () => {
    if (pwdInput === getStoredPwd()) {
      setIsAuthenticated(true);
      setAuthValid(true);
      setPwdInput('');
      setPwdError('');
      setPwdVisible(false);
    } else {
      setPwdError('Senha incorreta. Tente novamente.');
      setPwdInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthValid(false);
    setActiveTab('dashboard');
    setSidebarOpen(false);
  };

  const handleChangePassword = () => {
    if (newPwd.length < 4) {
      setPwdError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('As senhas não coincidem.');
      return;
    }
    localStorage.setItem(PWD_KEY, newPwd);
    setNewPwd('');
    setConfirmPwd('');
    setPwdError('');
    setShowChangePwd(false);
    alert('Senha alterada com sucesso!');
  };

  const handleTabChange = (tab: TabName) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // ── Reports ──
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
        }, {}
      );
      return { count: list.length, total, staffPerf };
    };
    return {
      daily:   calcStats(services.filter(s => s.date === todayStr)),
      monthly: calcStats(services.filter(s => s.date?.substring(0, 7) === todayStr.substring(0, 7))),
    };
  }, [services]);

  // ── CRUD ──
  const handleSave = () => {
    const colMap: Record<ModalType, string> = {
      customer: 'customers', vehicle: 'vehicles', staff: 'staff', service: 'services', quote: 'quotes',
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
        clientName:    formData.clientName ?? '',
        plate:         formData.plate ?? '',
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

  const handleDelete = (id: string) => {
    const colMap: Record<TabName, string> = {
      services: 'services', staff: 'staff', vehicles: 'vehicles',
      customers: 'customers', dashboard: '', reports: '', quotes: '',
    };
    const col = colMap[activeTab];
    if (!col) return;
    deleteItem(col, id);
    if (activeTab === 'services')  setServices(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'staff')     setStaff(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'vehicles')  setVehicles(prev => prev.filter(i => i.id !== id));
    if (activeTab === 'customers') setCustomers(prev => prev.filter(i => i.id !== id));
  };

  // ── Entregar serviço (atualiza status + pagamento) ──
  const openDelivery = (id: string) => {
    setDeliveryServiceId(id);
    setDeliveryPayment('Dinheiro');
    setShowDeliveryModal(true);
  };

  const confirmDelivery = () => {
    if (!deliveryServiceId) return;
    const updated = services.map(s =>
      s.id === deliveryServiceId
        ? { ...s, status: 'Entregue', paymentMethod: deliveryPayment }
        : s
    );
    setServices(updated);
    saveCol('services', updated);
    setShowDeliveryModal(false);
    setDeliveryServiceId(null);
  };

  // ── Orçamento: salvar ──
  const handleSaveQuote = () => {
    const validItems = quoteItems.filter(i => i.description.trim() !== '');
    if (!quoteClient.trim() || validItems.length === 0) return;
    const total = validItems.reduce((acc, i) => acc + i.qty * i.unitValue, 0);
    const newQuote = addItem<Omit<Quote, 'id'>>('quotes', {
      clientName: quoteClient, vehicleModel: quoteVehicle, vehiclePlate: quotePlate,
      items: validItems, total, status: 'Pendente', createdAt: new Date().toISOString(),
    });
    setQuotes(prev => [...prev, newQuote as Quote]);
    setShowModal(false);
    setQuoteClient(''); setQuoteVehicle(''); setQuotePlate('');
    setQuoteItems([{ description: '', qty: 1, unitValue: 0 }]);
  };

  // ── Orçamento: mudar status ──
  const changeQuoteStatus = (id: string, status: Quote['status']) => {
    const updated = quotes.map(q => q.id === id ? { ...q, status } : q);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // ── Orçamento: deletar ──
  const deleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    saveCol('quotes', updated);
  };

  // ── Orçamento: gerar PDF (abre janela de impressão) ──
  const printQuote = (quote: Quote) => {
    const rows = quote.items.map(i => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">${i.description}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:center">${i.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right">${formatBRL(i.unitValue)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700">${formatBRL(i.qty * i.unitValue)}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Orçamento – Gilmar Auto Center</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box} body{font-family:Arial,sans-serif;color:#1e293b;padding:40px;font-size:13px}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:3px solid #1B3155}
        .logo-text{line-height:1.1} .logo-text .brand{font-size:28px;font-weight:900;letter-spacing:2px;color:#1B3155} .logo-text .sub{font-size:13px;font-weight:700;letter-spacing:8px;color:#1B3155} .logo-text .tagline{font-size:10px;font-weight:400;color:#64748b;margin-top:3px}
        .info-block{background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px}
        .info-block h3{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:10px}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .info-row label{font-size:10px;color:#94a3b8;display:block} .info-row p{font-weight:700;font-size:14px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        thead tr{background:#1B3155;color:white} thead th{padding:12px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px}
        thead th:nth-child(2){text-align:center} thead th:nth-child(3),thead th:nth-child(4){text-align:right}
        .total-row{background:#eef2ff} .total-row td{padding:14px 8px;font-size:15px;font-weight:900;color:#1B3155;text-align:right}
        .total-row td:first-child{text-align:left;color:#1e293b}
        .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
        @media print{body{padding:20px}}
      </style></head><body>
      <div class="header">
        <div class="logo-text">
          <div class="brand">GILMAR</div>
          <div class="sub">AUTO CENTER</div>
          <div class="tagline">(21) 96421-6563 / 97535-6318</div>
        </div>
        <div style="text-align:right">
          <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Orçamento Nº</p>
          <p style="font-size:22px;font-weight:900;color:#2563eb">#${quote.id.slice(-6).toUpperCase()}</p>
          <p style="color:#64748b;margin-top:4px">${new Date(quote.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
      <div class="info-block">
        <h3>Dados do Cliente &amp; Veículo</h3>
        <div class="info-grid">
          <div class="info-row"><label>Cliente</label><p>${quote.clientName}</p></div>
          <div class="info-row"><label>Veículo</label><p>${quote.vehicleModel || '—'}</p></div>
          <div class="info-row"><label>Placa</label><p>${quote.vehiclePlate || '—'}</p></div>
        </div>
      </div>
      <table><thead><tr>
        <th>Descrição do Serviço</th><th style="text-align:center">Qtd.</th>
        <th style="text-align:right">Valor Unit.</th><th style="text-align:right">Total</th>
      </tr></thead><tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3">Total do Orçamento</td>
          <td>${formatBRL(quote.total)}</td>
        </tr>
      </tbody></table>
      <div class="footer">
        <span>Gilmar Auto Center – (21) 96421-6563 / 97535-6318</span>
        <span>Gerado em ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span>
      </div>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const getTableData = (): BaseItem[] => {
    if (activeTab === 'services')  return services;
    if (activeTab === 'staff')     return staff;
    if (activeTab === 'customers') return customers;
    return vehicles;
  };
  const getTableHeaders = () => {
    if (activeTab === 'staff')     return ['Profissional', 'Especialidade', 'Admitido em'];
    if (activeTab === 'vehicles')  return ['Modelo', 'Placa', 'Cadastrado em'];
    if (activeTab === 'customers') return ['Cliente', 'Telefone', 'Cadastrado em'];
    return ['Serviço / Cliente', 'Placa · Mecânico', 'Status'];
  };
  const getTableCells = (item: BaseItem) => {
    if (activeTab === 'staff')     { const s = item as Staff;     return [s.name, s.specialty || '-', s.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'vehicles')  { const v = item as Vehicle;   return [v.model, v.plate || '-', v.createdAt?.substring(0,10) || '-']; }
    if (activeTab === 'customers') { const c = item as Customer;  return [c.name, c.phone || '-', c.createdAt?.substring(0,10) || '-']; }
    const sv = item as Service;
    const svcTitle = sv.clientName ? `${sv.description} · ${sv.clientName}` : sv.description;
    const svcSub   = [sv.plate, sv.staffName || 'Sem mecânico'].filter(Boolean).join(' · ');
    return [svcTitle, svcSub, sv.status || 'Pendente'];
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  // ── Tela de login (acesso bloqueado sem senha) ──
  if (!isAuthenticated) return (
    <div className="h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white rounded-3xl p-8 md:p-10 w-full max-w-sm shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <GilmarLogo className="h-28 w-auto" />
        </div>
        <div className="relative mb-4">
          <input
            type={pwdVisible ? 'text' : 'password'}
            placeholder="Senha"
            value={pwdInput}
            onChange={e => { setPwdInput(e.target.value); setPwdError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
            className={`w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none font-bold text-sm transition-all ${pwdError ? 'ring-2 ring-red-400 bg-red-50' : 'focus:ring-2 focus:ring-blue-400'}`}
            autoFocus
          />
          <button type="button" onClick={() => setPwdVisible(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {pwdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {pwdError && (
          <p className="text-xs text-red-500 font-bold mb-4 flex items-center gap-1"><X size={12} />{pwdError}</p>
        )}
        <p className="text-[10px] text-slate-400 mb-6 text-center">Senha padrão: <span className="font-black text-slate-500">admin123</span></p>
        <button onClick={handleAdminLogin} className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all text-sm">
          Entrar
        </button>
      </div>
    </div>
  );

  const tableData    = getTableData().filter(i => JSON.stringify(i).toLowerCase().includes(searchTerm.toLowerCase()));
  const tableHeaders = getTableHeaders();

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* ── Overlay mobile ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col
        transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto
      `}>
        {/* Logo */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <GilmarLogo className="h-12 w-auto" />
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard"  active={activeTab} onClick={handleTabChange} />
          <NavItem id="services"  icon={Wrench}          label="Serviços"   active={activeTab} onClick={handleTabChange} />
          <NavItem id="quotes"    icon={FileText}        label="Orçamentos" active={activeTab} onClick={handleTabChange} />
          <NavItem id="vehicles"  icon={Car}             label="Veículos"   active={activeTab} onClick={handleTabChange} />
          <NavItem id="staff"     icon={Briefcase}       label="Equipa"     active={activeTab} onClick={handleTabChange} />
          <NavItem id="customers" icon={Users}           label="Clientes"   active={activeTab} onClick={handleTabChange} />
          <NavItem id="reports"   icon={BarChart3}       label="Relatórios" active={activeTab} onClick={handleTabChange} />
        </nav>

        {/* ── Sessão / Logout ── */}
        <div className="p-4 m-4 bg-white/5 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-wider">
              <Lock size={11} /> Administrador
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setPwdError(''); setNewPwd(''); setConfirmPwd(''); setShowChangePwd(true); setSidebarOpen(false); }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Alterar senha"
              >
                <KeyRound size={14} />
              </button>
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-400 transition-colors"
                title="Sair"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-10 pb-24 md:pb-10">

          {/* Header */}
          <header className="flex justify-between items-center mb-6 md:mb-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm">
                <Menu size={20} />
              </button>
              <div>
                <h2 className="text-blue-600 font-bold text-[9px] uppercase tracking-widest mb-0.5">Gilmar Auto Center</h2>
                <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight capitalize">{activeTab}</h1>
              </div>
            </div>
            {!['dashboard', 'reports'].includes(activeTab) && (
              <button
                onClick={() => { setModalType(getModalType(activeTab)); setShowModal(true); }}
                className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all text-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">{getAddLabel(activeTab)}</span>
              </button>
            )}
          </header>

          {/* ── Dashboard ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatBox title="Faturamento Hoje"     value={formatBRL(reportData.daily.total)} icon={DollarSign} color="text-emerald-500" />
                <StatBox title="Serviços Hoje"        value={String(reportData.daily.count)}                      icon={Wrench}     color="text-blue-500"   />
                <StatBox title="Profissionais Ativos" value={String(staff.length)}                                icon={UserCircle} color="text-purple-500" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black mb-4">Equipa em Campo</h3>
                  <div className="space-y-3">
                    {staff.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-full border border-slate-100 text-slate-400 flex-shrink-0"><UserCircle size={18} /></div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{s.specialty || 'Mecânico Geral'}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full uppercase flex-shrink-0 ml-2">Ativo</span>
                      </div>
                    ))}
                    {staff.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum profissional cadastrado.</p>}
                  </div>
                </div>
                <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black mb-4">Últimas Atribuições</h3>
                  <div className="space-y-3">
                    {services.slice(-4).reverse().map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border-l-4 border-blue-500">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-sm truncate">{s.description}</p>
                          <p className="text-[10px] text-slate-500 font-bold flex items-center mt-0.5">
                            <UserCircle size={11} className="mr-1 flex-shrink-0" />
                            <span className="truncate">{s.staffName || 'Pendente'}</span>
                          </p>
                        </div>
                        <span className="font-black text-slate-400 text-xs flex-shrink-0 ml-2">{s.date}</span>
                      </div>
                    ))}
                    {services.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum serviço registado.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Relatórios ── */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatBox title="Faturamento Mensal" value={formatBRL(reportData.monthly.total)} icon={DollarSign} color="text-emerald-500" />
                <StatBox title="Serviços no Mês"   value={String(reportData.monthly.count)}    icon={Wrench}     color="text-blue-500"   />
              </div>
              <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-black mb-5 flex items-center gap-2 text-blue-600">
                  <Briefcase size={18} /> Produtividade da Equipa (Mensal)
                </h3>
                <div className="overflow-x-auto -mx-5 md:mx-0 px-5 md:px-0">
                  <table className="w-full min-w-[360px]">
                    <thead>
                      <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="pb-3">Profissional</th>
                        <th className="pb-3">Qtd.</th>
                        <th className="pb-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {Object.entries(reportData.monthly.staffPerf).map(([name, stats]) => (
                        <tr key={name}>
                          <td className="py-3 font-bold text-slate-700 text-sm">{name}</td>
                          <td className="py-3 text-sm text-slate-500">{stats.count} serv.</td>
                          <td className="py-3 text-right font-black text-slate-800 text-sm">{formatBRL(stats.total)}</td>
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

          {/* ── Orçamentos ── */}
          {activeTab === 'quotes' && (
            <div className="space-y-4">
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {quotes.filter(q => JSON.stringify(q).toLowerCase().includes(searchTerm.toLowerCase())).map(q => (
                  <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-800 truncate">{q.clientName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{q.vehicleModel || '—'} {q.vehiclePlate ? `· ${q.vehiclePlate}` : ''}</p>
                      </div>
                      <QuoteStatusBadge status={q.status} />
                    </div>
                    <p className="text-lg font-black text-blue-600 mb-3">{formatBRL(q.total)}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => printQuote(q)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded-xl hover:bg-slate-200 transition-colors">
                        <Printer size={13} /> PDF
                      </button>
                      {q.status === 'Pendente' && (
                        <>
                          <button onClick={() => changeQuoteStatus(q.id, 'Aprovado')} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold py-2 rounded-xl hover:bg-emerald-100 transition-colors">
                            <ThumbsUp size={13} /> Aprovar
                          </button>
                          <button onClick={() => changeQuoteStatus(q.id, 'Recusado')} className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 text-xs font-bold py-2 rounded-xl hover:bg-red-100 transition-colors">
                            <ThumbsDown size={13} /> Recusar
                          </button>
                        </>
                      )}
                      <button onClick={() => deleteQuote(q.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {quotes.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Nenhum orçamento ainda. Crie o primeiro!</p>}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center bg-slate-50/50">
                  <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                  <input placeholder="Procurar orçamentos..." className="bg-transparent outline-none w-full font-medium text-sm" onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="p-5">Cliente</th>
                      <th className="p-5">Veículo / Placa</th>
                      <th className="p-5">Total</th>
                      <th className="p-5">Status</th>
                      <th className="p-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quotes.filter(q => JSON.stringify(q).toLowerCase().includes(searchTerm.toLowerCase())).map(q => (
                      <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-5 font-bold text-slate-800 text-sm">{q.clientName}</td>
                        <td className="p-5 text-sm text-slate-500">{q.vehicleModel || '—'}{q.vehiclePlate ? ` · ${q.vehiclePlate}` : ''}</td>
                        <td className="p-5 font-black text-blue-600 text-sm">{formatBRL(q.total)}</td>
                        <td className="p-5"><QuoteStatusBadge status={q.status} /></td>
                        <td className="p-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => printQuote(q)} title="Gerar PDF" className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
                              <Printer size={14} /> PDF
                            </button>
                            {q.status === 'Pendente' && (
                              <>
                                <button onClick={() => changeQuoteStatus(q.id, 'Aprovado')} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors">
                                  <ThumbsUp size={13} /> Aprovar
                                </button>
                                <button onClick={() => changeQuoteStatus(q.id, 'Recusado')} className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors">
                                  <ThumbsDown size={13} /> Recusar
                                </button>
                              </>
                            )}
                            <button onClick={() => deleteQuote(q.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={17} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {quotes.length === 0 && (
                      <tr><td colSpan={5} className="p-10 text-center text-slate-400 text-sm">Nenhum orçamento registado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tabela / Cards ── */}
          {(['services', 'staff', 'vehicles', 'customers'] as TabName[]).includes(activeTab) && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 md:p-4 border-b flex items-center bg-slate-50/50">
                <Search className="text-slate-300 mr-2 flex-shrink-0" size={18} />
                <input placeholder="Procurar na base..." className="bg-transparent outline-none w-full font-medium text-sm" onChange={e => setSearchTerm(e.target.value)} />
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {tableData.map(item => {
                  const cells = getTableCells(item);
                  const isSvc = activeTab === 'services';
                  const svc = isSvc ? (item as Service) : null;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 text-sm truncate">{cells[0]}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{cells[1]}</p>
                        {isSvc && svc
                          ? <div className="mt-1"><StatusBadge status={svc.status} paymentMethod={svc.paymentMethod} /></div>
                          : <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-bold">{cells[2]}</p>
                        }
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {isSvc && svc && svc.status === 'Pendente' && (
                          <button
                            onClick={() => openDelivery(item.id)}
                            className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors"
                          >
                            <CheckCircle size={12} /> Entregar
                          </button>
                        )}
                        <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {tableData.length === 0 && <p className="p-8 text-center text-slate-400 text-sm">Nenhum registo encontrado.</p>}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      {tableHeaders.map((h, i) => <th key={i} className="p-6">{h}</th>)}
                      <th className="p-6 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tableData.map(item => {
                      const cells = getTableCells(item);
                      const isSvc = activeTab === 'services';
                      const svc = isSvc ? (item as Service) : null;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          {cells.map((cell, i) => (
                            <td key={i} className={`p-6 text-sm ${i === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>
                              {isSvc && i === 2 && svc
                                ? <StatusBadge status={svc.status} paymentMethod={svc.paymentMethod} />
                                : cell}
                            </td>
                          ))}
                          <td className="p-6 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {isSvc && svc && svc.status === 'Pendente' && (
                                <button
                                  onClick={() => openDelivery(item.id)}
                                  className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors"
                                >
                                  <CheckCircle size={14} /> Entregar
                                </button>
                              )}
                              <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {tableData.length === 0 && (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-400 text-sm">Nenhum registo encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* ── Bottom Nav (mobile) ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/5 flex z-30">
          <BottomNavItem id="dashboard" icon={LayoutDashboard} label="Home"       active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="services"  icon={Wrench}          label="Serviços"   active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="quotes"    icon={FileText}        label="Orçamentos" active={activeTab} onClick={handleTabChange} />
          <BottomNavItem id="vehicles"  icon={Car}             label="Veículos"   active={activeTab} onClick={handleTabChange} />
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-3 text-slate-400 hover:text-white transition-colors"
          >
            <Menu size={20} />
            <span className="text-[9px] mt-1 font-bold">Menu</span>
          </button>
        </nav>
      </div>

      {/* ══════════════════════════════════════════
          MODAL ALTERAR SENHA
      ══════════════════════════════════════════ */}
      {showChangePwd && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[60]">
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-sm shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />

            <div className="flex flex-col items-center mb-6">
              <div className="bg-slate-800 p-4 rounded-2xl mb-4">
                <KeyRound size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Alterar Senha</h2>
              <p className="text-sm text-slate-400 mt-1 text-center">Defina uma nova senha para o acesso admin</p>
            </div>

            <div className="space-y-3 mb-4">
              <div className="relative">
                <input
                  type={newPwdVisible ? 'text' : 'password'}
                  placeholder="Nova senha (mín. 4 caracteres)"
                  value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); setPwdError(''); }}
                  className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-400"
                />
                <button type="button" onClick={() => setNewPwdVisible(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {newPwdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <input
                type={newPwdVisible ? 'text' : 'password'}
                placeholder="Confirmar nova senha"
                value={confirmPwd}
                onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {pwdError && (
              <p className="text-xs text-red-500 font-bold mb-4 flex items-center gap-1">
                <X size={12} /> {pwdError}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowChangePwd(false); setPwdError(''); }} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={handleChangePassword} className="flex-1 p-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all text-sm">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de registo (OS / Veículo / etc) ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />
            <h2 className="text-xl md:text-2xl font-black mb-6">
              {modalType === 'staff' ? 'Novo Profissional' : modalType === 'vehicle' ? 'Novo Veículo' : modalType === 'customer' ? 'Novo Cliente' : modalType === 'quote' ? 'Novo Orçamento' : 'Novo Serviço'}
            </h2>
            <div className="space-y-4">
              {modalType === 'staff' && (
                <>
                  <input placeholder="Nome do Mecânico" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                  <input placeholder="Especialidade (Ex: Suspensão, Motor)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, specialty: e.target.value}))} />
                </>
              )}
              {modalType === 'vehicle' && (
                <>
                  <input placeholder="Modelo do Veículo (Ex: Civic 2022)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, model: e.target.value}))} />
                  <input placeholder="Placa (Ex: ABC-1234)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, plate: e.target.value}))} />
                </>
              )}
              {modalType === 'customer' && (
                <>
                  <input placeholder="Nome do Cliente" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                  <input placeholder="Telefone (Ex: 11 99999-9999)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, phone: e.target.value}))} />
                </>
              )}
              {modalType === 'service' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Nome do Cliente *" className="p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, clientName: e.target.value}))} />
                    <input placeholder="Placa (Ex: ABC-1234) *" className="p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm uppercase" onChange={e => setFormData(f => ({...f, plate: e.target.value.toUpperCase()}))} />
                  </div>
                  <input placeholder="Descrição do Serviço" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, description: e.target.value}))} />
                  <input type="number" placeholder="Valor estimado (BRL)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" onChange={e => setFormData(f => ({...f, value: e.target.value}))} />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Profissional Responsável</p>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 text-sm" onChange={e => setFormData(f => ({...f, staffName: e.target.value}))}>
                      <option value="">Selecione o mecânico...</option>
                      {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  {/* Info: pagamento é definido na entrega */}
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    <Clock size={14} className="text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700 font-bold">A forma de pagamento será definida na entrega do serviço.</p>
                  </div>
                </>
              )}
              {modalType === 'quote' && (
                <>
                  {/* Cliente + Veículo */}
                  <input
                    placeholder="Nome do Cliente *"
                    value={quoteClient}
                    onChange={e => setQuoteClient(e.target.value)}
                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Modelo (Ex: Civic 2022)"
                      value={quoteVehicle}
                      onChange={e => setQuoteVehicle(e.target.value)}
                      className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm"
                    />
                    <input
                      placeholder="Placa (Ex: ABC-1234)"
                      value={quotePlate}
                      onChange={e => setQuotePlate(e.target.value)}
                      className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm"
                    />
                  </div>

                  {/* Itens do orçamento */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviços / Itens *</p>
                      <button
                        onClick={() => setQuoteItems(prev => [...prev, { description: '', qty: 1, unitValue: 0 }])}
                        className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:text-blue-700"
                      >
                        <PlusCircle size={14} /> Adicionar item
                      </button>
                    </div>
                    <div className="space-y-2">
                      {quoteItems.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            placeholder="Descrição do serviço"
                            value={item.description}
                            onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                            className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm min-w-0"
                          />
                          <input
                            type="number"
                            placeholder="Qtd"
                            value={item.qty}
                            min={1}
                            onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: parseInt(e.target.value) || 1 } : it))}
                            className="w-14 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm text-center"
                          />
                          <input
                            type="number"
                            placeholder="R$"
                            value={item.unitValue || ''}
                            min={0}
                            onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, unitValue: parseFloat(e.target.value) || 0 } : it))}
                            className="w-24 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm"
                          />
                          {quoteItems.length > 1 && (
                            <button onClick={() => setQuoteItems(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                              <MinusCircle size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <span className="text-sm font-black text-slate-600">Total do Orçamento</span>
                    <span className="text-lg font-black text-blue-600">
                      {formatBRL(quoteItems.reduce((acc, i) => acc + i.qty * i.unitValue, 0))}
                    </span>
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-4 border-t">
                <button onClick={() => setShowModal(false)} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">Cancelar</button>
                <button
                  onClick={modalType === 'quote' ? handleSaveQuote : handleSave}
                  className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all text-sm"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL ENTREGA DO SERVIÇO
      ══════════════════════════════════════════ */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[60]">
          <div className="bg-white rounded-t-3xl md:rounded-[32px] p-6 md:p-10 w-full md:max-w-sm shadow-2xl">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6 md:hidden" />

            <div className="flex flex-col items-center mb-8">
              <div className="bg-emerald-500 p-4 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
                <CheckCircle size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Entregar Serviço</h2>
              <p className="text-sm text-slate-400 mt-1 text-center">Selecione a forma de pagamento para finalizar</p>
            </div>

            <div className="mb-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Forma de Pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {['Dinheiro', 'Pix', 'Cartão'].map(method => (
                  <button
                    key={method}
                    onClick={() => setDeliveryPayment(method)}
                    className={`p-3 rounded-2xl font-bold text-sm border-2 transition-all ${
                      deliveryPayment === method
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowDeliveryModal(false)} className="flex-1 p-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={confirmDelivery} className="flex-1 p-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all text-sm">
                Confirmar Entrega
              </button>
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
  active: TabName; onClick: (id: TabName) => void;
}
const NavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
      active === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}
  >
    <Icon size={18} className="flex-shrink-0" />
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const BottomNavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
      active === id ? 'text-blue-400' : 'text-slate-500 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="text-[9px] mt-1 font-bold truncate w-full text-center px-1">{label}</span>
  </button>
);

interface StatBoxProps { title: string; value: string; icon: React.ElementType<any>; color: string; }
const StatBox: React.FC<StatBoxProps> = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-xl md:text-2xl font-black">{value}</p>
    </div>
    <div className={`p-3 rounded-xl bg-slate-50 ${color} flex-shrink-0`}><Icon size={20} /></div>
  </div>
);

interface StatusBadgeProps { status: string; paymentMethod?: string; }
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, paymentMethod }) => {
  if (status === 'Entregue') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full">
        <CheckCircle size={10} />
        Entregue{paymentMethod ? ` · ${paymentMethod}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full">
      <Clock size={10} />
      Pendente
    </span>
  );
};

interface QuoteStatusBadgeProps { status: Quote['status']; }
const QuoteStatusBadge: React.FC<QuoteStatusBadgeProps> = ({ status }) => {
  if (status === 'Aprovado') return (
    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full">
      <ThumbsUp size={10} /> Aprovado
    </span>
  );
  if (status === 'Recusado') return (
    <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-[10px] font-black px-2.5 py-1 rounded-full">
      <ThumbsDown size={10} /> Recusado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full">
      <Clock size={10} /> Pendente
    </span>
  );
};

interface GilmarLogoProps { className?: string; }
const GilmarLogo: React.FC<GilmarLogoProps> = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 290" fill="none" className={className}>
    <g fill="#4DBDE8">
      <path d="M245 118 C220 112 192 108 165 112 C148 115 132 122 118 128 C135 122 155 118 178 117 C202 116 228 120 245 118Z" opacity="0.65"/>
      <path d="M248 107 C222 100 193 96 164 100 C144 104 126 113 110 120 C128 112 150 107 174 106 C200 105 228 110 248 107Z" opacity="0.75"/>
      <path d="M252 96 C226 88 196 84 165 88 C142 92 122 102 105 111 C124 102 148 96 173 95 C200 94 230 99 252 96Z"/>
      <path d="M252 96 C265 85 282 78 300 76 C318 74 335 80 345 92 C352 100 352 112 344 120 C336 128 322 130 310 126 C295 121 280 110 268 102 C262 98 257 96 252 96Z"/>
      <path d="M344 92 C350 86 360 82 370 83 C378 84 383 90 380 97 C377 103 368 106 360 104 C352 102 346 97 344 92Z"/>
      <path d="M378 85 L396 78 L382 95 Z"/>
      <path d="M290 82 C298 72 312 68 324 72 C312 75 300 80 292 88Z" opacity="0.55"/>
      <path d="M300 126 L292 148 L286 148" stroke="#4DBDE8" strokeWidth="4" strokeLinecap="round"/>
      <path d="M318 128 L312 150 L320 150" stroke="#4DBDE8" strokeWidth="4" strokeLinecap="round"/>
    </g>
    <text x="230" y="210" textAnchor="middle" fill="#1B3155" fontFamily="'Arial Black','Arial Bold',Impact,sans-serif" fontSize="92" fontWeight="900" letterSpacing="4">GILMAR</text>
    <text x="230" y="262" textAnchor="middle" fill="#1B3155" fontFamily="'Arial Black','Arial Bold',Impact,sans-serif" fontSize="38" fontWeight="700" letterSpacing="18">AUTO CENTER</text>
  </svg>
);

export default App;
