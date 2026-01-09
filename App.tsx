
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Wrench, 
  Users, 
  Package, 
  Plus, 
  BrainCircuit, 
  MessageCircle, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Printer,
  X,
  History,
  Phone,
  User,
  Trash2,
  Copy,
  ExternalLink,
  BarChart3,
  TrendingUp,
  FileText,
  Download,
  Upload,
  Database,
  RefreshCcw,
  ShieldCheck,
  PlusCircle,
  MinusCircle,
  Calculator,
  Receipt,
  Save,
  Search,
  Bell,
  Check,
  Edit2,
  ShoppingCart
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { Client, InventoryItem, ServiceOrder, OrderStatus, StatusHistoryEntry, UsedPart, PartReminder, PartReminderStatus } from './types';
import { getPrinterDiagnosis, generateClientMessage } from './services/geminiService';

const LOGO_IMAGE = '/logo.png';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'clients' | 'reminders'>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Safe initialization of states with robust error handling for LocalStorage
  const [orders, setOrders] = useState<ServiceOrder[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_orders');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_inventory');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_clients');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const [partReminders, setPartReminders] = useState<PartReminder[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_part_reminders');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  // Persistence effects
  useEffect(() => { localStorage.setItem('maqara_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('maqara_inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('maqara_clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('maqara_part_reminders', JSON.stringify(partReminders)); }, [partReminders]);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  
  const [editingReminder, setEditingReminder] = useState<PartReminder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');

  const [aiMessage, setAiMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [printType, setPrintType] = useState<'client_individual' | 'client_general' | 'inventory' | 'os_detail' | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<ServiceOrder | null>(null);

  // Memos for performance and safety
  const filteredClients = useMemo(() => {
    if (!clientSearch || !Array.isArray(clients)) return [];
    return clients.filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clientSearch, clients]);

  const sortedReminders = useMemo(() => {
    const statusOrder = {
      [PartReminderStatus.PENDING]: 0,
      [PartReminderStatus.ORDERED]: 1,
      [PartReminderStatus.RECEIVED]: 2,
    };
    if (!Array.isArray(partReminders)) return [];
    return [...partReminders].sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 0;
      const orderB = statusOrder[b.status] ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [partReminders]);

  useEffect(() => {
    if (selectedOrder) {
      setEditingOrder(JSON.parse(JSON.stringify(selectedOrder)));
    } else {
      setEditingOrder(null);
    }
  }, [selectedOrder]);

  const stats = useMemo(() => {
    const revenue = orders?.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.READY).reduce((acc, curr) => acc + (curr.totalCost || 0), 0) || 0;
    const pending = orders?.filter(o => o.status !== OrderStatus.DELIVERED).length || 0;
    const lowStock = inventory?.filter(i => i.quantity <= (i.minStock || 0)).length || 0;
    const pendingReminders = partReminders?.filter(r => r.status === PartReminderStatus.PENDING).length || 0;
    return { revenue, pending, lowStock, pendingReminders };
  }, [orders, inventory, partReminders]);

  const chartData = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const counts = orders.reduce((acc, order) => { 
      const status = order.status || 'Outro';
      acc[status] = (acc[status] || 0) + 1; 
      return acc; 
    }, {} as Record<string, number>);
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [orders]);

  // Actions
  const handleDeleteClient = (id: string) => { if (window.confirm('Excluir este cliente?')) setClients(prev => prev.filter(c => c.id !== id)); };
  const handleDeleteOrder = (id: string, e?: React.MouseEvent) => { if (e) e.stopPropagation(); if (window.confirm('Excluir esta OS permanentemente?')) setOrders(prev => prev.filter(o => o.id !== id)); };
  const handleDeleteInventoryItem = (id: string) => { if (window.confirm('Remover do estoque?')) setInventory(prev => prev.filter(i => i.id !== id)); };
  const handleDeleteReminder = (id: string) => { if (window.confirm('Excluir este lembrete?')) setPartReminders(prev => prev.filter(r => r.id !== id)); };
  const handleUpdateReminderStatus = (id: string, status: PartReminderStatus) => { setPartReminders(prev => prev.map(r => r.id === id ? { ...r, status } : r)); };

  const handleSaveReminder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const partName = formData.get('partName') as string;
    const quantity = parseInt(formData.get('quantity') as string) || 1;
    const notes = formData.get('notes') as string;
    if (editingReminder) {
      setPartReminders(prev => prev.map(r => r.id === editingReminder.id ? { ...r, partName, quantity, notes } : r));
    } else {
      setPartReminders(prev => [{ id: Date.now().toString(), partName, quantity, notes, status: PartReminderStatus.PENDING, createdAt: new Date() }, ...prev]);
    }
    setIsReminderModalOpen(false);
    setEditingReminder(null);
  };

  const handleAddPartToDraft = (itemId: string, qty: number) => {
    if (!editingOrder) return;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const alreadyUsed = editingOrder.partsUsed?.find(p => p.inventoryItemId === itemId)?.quantity || 0;
    if (item.quantity < alreadyUsed + qty) { alert('Estoque insuficiente!'); return; }
    const newParts = [...(editingOrder.partsUsed || [])];
    const idx = newParts.findIndex(p => p.inventoryItemId === itemId);
    if (idx > -1) newParts[idx].quantity += qty; else newParts.push({ inventoryItemId: itemId, name: item.name, quantity: qty, unitPrice: item.sellPrice });
    const cost = newParts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
    setEditingOrder({ ...editingOrder, partsUsed: newParts, partsCost: cost, totalCost: editingOrder.laborCost + cost });
  };

  const handleRemovePartFromDraft = (itemId: string) => {
    if (!editingOrder) return;
    const newParts = (editingOrder.partsUsed || []).filter(p => p.inventoryItemId !== itemId);
    const cost = newParts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
    setEditingOrder({ ...editingOrder, partsUsed: newParts, partsCost: cost, totalCost: editingOrder.laborCost + cost });
  };

  const handleSaveOrderChanges = async () => {
    if (!editingOrder || !selectedOrder) return;
    setIsSaving(true);
    const updatedInv = [...inventory];
    selectedOrder.partsUsed?.forEach(p => { const item = updatedInv.find(i => i.id === p.inventoryItemId); if (item) item.quantity += p.quantity; });
    editingOrder.partsUsed?.forEach(p => { const item = updatedInv.find(i => i.id === p.inventoryItemId); if (item) item.quantity -= p.quantity; });
    const updatedOrder = { ...editingOrder, updatedAt: new Date() };
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setInventory(updatedInv);
    setSelectedOrder(updatedOrder);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, updatedAt: new Date(), history: [{ status: newStatus, date: new Date(), user: 'Técnico' }, ...(o.history || [])] } : o));
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, status: newStatus, updatedAt: new Date(), history: [{ status: newStatus, date: new Date(), user: 'Técnico' }, ...(selectedOrder.history || [])] });
    }
  };

  const handleExportBackup = () => {
    const data = { clients, inventory, orders, partReminders, backupDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${new Date().getTime()}.json`;
    link.click();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (d.clients) setClients(d.clients);
        if (d.inventory) setInventory(d.inventory);
        if (d.orders) setOrders(d.orders);
        if (d.partReminders) setPartReminders(d.partReminders);
        alert('Backup restaurado!');
      } catch { alert('Erro ao importar!'); }
    };
    reader.readAsText(file);
  };

  const handlePrint = () => { setTimeout(() => { window.print(); setPrintType(null); }, 100); };

  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#64748b'];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans print:bg-white">
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm print:hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-center">
          <img src={LOGO_IMAGE} alt="Logo" className="h-16 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x60?text=MAQARA'; }} />
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavButton icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={<Wrench size={20}/>} label="Serviços" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavButton icon={<Package size={20}/>} label="Estoque" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavButton icon={<Users size={20}/>} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
          <NavButton icon={<Bell size={20}/>} label="Lembretes" active={activeTab === 'reminders'} onClick={() => setActiveTab('reminders')} badge={stats.pendingReminders || undefined} />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative print:p-0">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in print:space-y-4">
          <div className="flex justify-between items-end mb-4 print:hidden">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'orders' ? 'Ordens de Serviço' : activeTab === 'reminders' ? 'Lembretes' : activeTab === 'inventory' ? 'Estoque' : 'Clientes'}
              </h1>
            </div>
            <div className="flex gap-3">
              {activeTab === 'orders' && <button onClick={() => { setClientSearch(''); setSelectedClientId(''); setIsOrderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Nova OS</button>}
              {activeTab === 'reminders' && <button onClick={() => { setEditingReminder(null); setIsReminderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Lembrete</button>}
              {activeTab === 'clients' && <button onClick={() => setIsClientModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Cliente</button>}
              {activeTab === 'inventory' && <button onClick={() => setIsInventoryModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Item</button>}
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <DashboardStat label="Faturamento" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<TrendingUp className="text-green-600"/>} trend="+12%" />
                <DashboardStat label="OS Ativas" value={stats.pending.toString()} icon={<Clock className="text-amber-600"/>} trend="Abertas" />
                <DashboardStat label="Estoque Baixo" value={stats.lowStock.toString()} icon={<AlertTriangle className="text-red-600"/>} trend="Crítico" critical={stats.lowStock > 0} />
                <DashboardStat label="A Pedir" value={stats.pendingReminders.toString()} icon={<ShoppingCart className="text-red-600"/>} trend="Peças" critical={stats.pendingReminders > 0} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-8"><BarChart3 size={18}/> Status dos Serviços</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none" cornerRadius={4}>
                          {chartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-6"><Database size={18}/> Backup</h3>
                  <button onClick={handleExportBackup} className="w-full flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-2xl font-black mb-4"><Download size={20}/> Exportar JSON</button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl font-black"><Upload size={20}/> Importar JSON</button>
                  <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="p-6">OS / Máquina</th><th className="p-6">Cliente</th><th className="p-6">Total</th><th className="p-6">Status</th><th className="p-6 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders?.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400">Nenhuma ordem de serviço cadastrada.</td></tr>
                  ) : orders?.map(o => (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-red-50/20 cursor-pointer group transition-colors">
                      <td className="p-6"><div className="font-black text-red-600">#{o.id}</div><div className="text-sm text-slate-500">{o.printerModel}</div></td>
                      <td className="p-6 font-bold">{clients?.find(c => c.id === o.clientId)?.name || 'N/A'}</td>
                      <td className="p-6 font-black text-slate-900">R$ {(o.totalCost || 0).toFixed(2)}</td>
                      <td className="p-6"><StatusBadge status={o.status}/></td>
                      <td className="p-6 text-right"><div className="flex justify-end gap-2"><button onClick={(e) => handleDeleteOrder(o.id, e)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button><ChevronRight size={20} className="text-slate-300 group-hover:text-red-600 inline"/></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="p-6">Peça</th><th className="p-6">Saldo</th><th className="p-6">Venda</th><th className="p-6 text-center">Status</th><th className="p-6 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory?.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400">Nenhum item no estoque.</td></tr>
                  ) : inventory?.map(i => (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-bold">{i.name}</td>
                      <td className="p-6 font-black">{i.quantity} un</td>
                      <td className="p-6 font-bold text-slate-600">R$ {(i.sellPrice || 0).toFixed(2)}</td>
                      <td className="p-6 text-center">
                        {i.quantity <= (i.minStock || 0) ? <span className="text-red-600 font-black text-[10px]">REPOR</span> : <span className="text-green-600 font-black text-[10px]">OK</span>}
                      </td>
                      <td className="p-6 text-right">
                        <button onClick={() => handleDeleteInventoryItem(i.id)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="p-6">Nome do Cliente</th><th className="p-6">WhatsApp</th><th className="p-6 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients?.length === 0 ? (
                    <tr><td colSpan={3} className="p-20 text-center text-slate-400">Nenhum cliente cadastrado.</td></tr>
                  ) : clients?.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-6 font-black">{c.name}</td>
                      <td className="p-6 font-bold text-slate-600">{c.phone}</td>
                      <td className="p-6 text-right flex justify-end gap-3">
                        <button onClick={() => handleDeleteClient(c.id)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="p-6">Peça</th><th className="p-6">Qtd</th><th className="p-6">Data</th><th className="p-6">Status</th><th className="p-6 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedReminders.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400">Nenhum lembrete cadastrado.</td></tr>
                  ) : sortedReminders.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${r.status === PartReminderStatus.RECEIVED ? 'opacity-50' : ''}`}>
                      <td className="p-6"><div className="font-black">{r.partName}</div>{r.notes && <div className="text-[10px] text-slate-500">{r.notes}</div>}</td>
                      <td className="p-6 font-black">{r.quantity}</td>
                      <td className="p-6 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="p-6"><ReminderStatusBadge status={r.status}/></td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === PartReminderStatus.PENDING && <button onClick={() => handleUpdateReminderStatus(r.id, PartReminderStatus.ORDERED)} className="p-2 text-blue-600"><ShoppingCart size={18}/></button>}
                          {r.status === PartReminderStatus.ORDERED && <button onClick={() => handleUpdateReminderStatus(r.id, PartReminderStatus.RECEIVED)} className="p-2 text-green-600"><CheckCircle size={18}/></button>}
                          <button onClick={() => { setEditingReminder(r); setIsReminderModalOpen(true); }} className="p-2 text-slate-400"><Edit2 size={18}/></button>
                          <button onClick={() => handleDeleteReminder(r.id)} className="p-2 text-slate-300"><Trash2 size={18}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Drawer Detalhes OS */}
      {selectedOrder && editingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-end print:hidden">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="bg-slate-50 p-2 rounded-xl"><img src={LOGO_IMAGE} alt="Logo" className="h-10 w-auto object-contain" /></div>
                <div><h2 className="text-xl font-black text-slate-900 uppercase">OS #{editingOrder.id}</h2><p className="text-slate-500 font-medium text-xs">{editingOrder.printerModel}</p></div>
              </div>
              <button onClick={() => { setSelectedOrder(null); }} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-8 flex-1">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map(s => (
                    <button key={s} onClick={() => handleUpdateStatus(editingOrder.id, s)} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${editingOrder.status === s ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="border border-red-100 rounded-[32px] overflow-hidden bg-white shadow-sm">
                <div className="p-8 space-y-6">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relatório Técnico</label><textarea value={editingOrder.diagnosis || ''} onChange={(e) => setEditingOrder({...editingOrder, diagnosis: e.target.value})} rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl" placeholder="Diagnóstico..." /></div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peças</label>
                    <div className="flex gap-2">
                      <select id="part-select" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"><option value="">Peça...</option>{inventory?.filter(i => i.quantity > 0).map(i => ( <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option> ))}</select>
                      <button onClick={() => { const sel = document.getElementById('part-select') as HTMLSelectElement; if (sel.value) handleAddPartToDraft(sel.value, 1); }} className="bg-red-600 text-white px-4 rounded-xl"><Plus size={20}/></button>
                    </div>
                  </div>
                  {editingOrder.partsUsed?.length > 0 && (
                    <div className="space-y-2">{editingOrder.partsUsed.map((p, idx) => ( <div key={idx} className="flex justify-between items-center bg-white border p-4 rounded-2xl shadow-sm"><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-slate-400 uppercase">{p.quantity} un</p></div><button onClick={() => handleRemovePartFromDraft(p.inventoryItemId)} className="text-slate-300"><Trash2 size={16}/></button></div> ))}</div>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mão de Obra</label><input type="number" step="0.01" value={editingOrder.laborCost || ''} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setEditingOrder({...editingOrder, laborCost: val, totalCost: val + editingOrder.partsCost}); }} className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-right" /></div>
                  <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center"><div className="text-left"><p className="text-[10px] uppercase font-black">Subtotal</p><p className="text-lg font-bold">R$ {(editingOrder.partsCost || 0).toFixed(2)}</p></div><div className="text-right"><p className="text-[10px] uppercase font-black text-red-500">Total</p><p className="text-2xl font-black">R$ {(editingOrder.totalCost || 0).toFixed(2)}</p></div></div>
                  <button onClick={handleSaveOrderChanges} disabled={isSaving} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 ${saveSuccess ? 'bg-green-600 text-white' : 'bg-red-600 text-white shadow-xl'}`}>{isSaving ? <RefreshCcw className="animate-spin" size={20}/> : saveSuccess ? <CheckCircle size={20}/> : <Save size={20}/>}{saveSuccess ? 'Salvo!' : 'Salvar Alterações'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SaaSModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Nova Ordem de Serviço">
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          const formData = new FormData(e.currentTarget); 
          if (!selectedClientId) { alert('Selecione um cliente.'); return; } 
          const newOrder: ServiceOrder = { 
            id: `OS-${Math.floor(1000 + Math.random() * 9000)}`, 
            clientId: selectedClientId, 
            printerModel: formData.get('printerModel') as string, 
            serialNumber: formData.get('serialNumber') as string, 
            problemDescription: formData.get('problemDescription') as string, 
            status: OrderStatus.PENDING, 
            history: [{ status: OrderStatus.PENDING, date: new Date(), user: 'Recepção', description: 'Entrada.' }], 
            priority: formData.get('priority') as any, 
            laborCost: 0, 
            partsCost: 0, 
            totalCost: 0, 
            partsUsed: [], 
            createdAt: new Date(), 
            updatedAt: new Date() 
          }; 
          setOrders(prev => [newOrder, ...prev]); 
          setIsOrderModalOpen(false); 
          setClientSearch(''); 
          setSelectedClientId(''); 
        }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase">Cliente (Buscar)</label>
              <div className="relative">
                <input type="text" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); if (selectedClientId) setSelectedClientId(''); }} onFocus={() => setShowClientResults(true)} className="w-full p-4 pl-10 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome..." required={!selectedClientId} />
                <Search className="absolute left-3 top-4 text-slate-400" size={18}/>
              </div>
              {showClientResults && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[210] mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                  {filteredClients.map(c => (<div key={c.id} onClick={() => { setClientSearch(c.name); setSelectedClientId(c.id); setShowClientResults(false); }} className="p-4 hover:bg-red-50 cursor-pointer font-bold border-b last:border-0">{c.name}</div>))}
                </div>
              )}
            </div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Prioridade</label><select name="priority" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold"><option value="Normal">Normal</option><option value="Baixa">Baixa</option><option value="Alta">Alta</option></select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="printerModel" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Modelo" required /><input name="serialNumber" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="N/S" /></div>
          <textarea name="problemDescription" rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Defeito..." required />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest">Abrir OS</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Novo Cliente">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); setClients(prev => [...prev, { id: Date.now().toString(), name: formData.get('name') as string, phone: formData.get('phone') as string, email: formData.get('email') as string }]); setIsClientModalOpen(false); }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome" required />
          <input name="phone" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="WhatsApp" required />
          <input name="email" type="email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Email" />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Confirmar</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Novo Item de Estoque">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); setInventory(prev => [...prev, { id: Date.now().toString(), name: formData.get('name') as string, quantity: parseInt(formData.get('quantity') as string), minStock: parseInt(formData.get('minStock') as string), costPrice: parseFloat(formData.get('costPrice') as string), sellPrice: parseFloat(formData.get('sellPrice') as string) }]); setIsInventoryModalOpen(false); }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça" required />
          <div className="grid grid-cols-2 gap-4"><input name="quantity" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Qtd" required /><input name="minStock" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Mínimo" required /></div>
          <div className="grid grid-cols-2 gap-4"><input name="costPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço Custo" required /><input name="sellPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço Venda" required /></div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Salvar</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isReminderModalOpen} onClose={() => setIsReminderModalOpen(false)} title="Lembrete de Peça">
        <form onSubmit={handleSaveReminder} className="space-y-6">
          <input name="partName" type="text" defaultValue={editingReminder?.partName || ''} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça" required />
          <input name="quantity" type="number" defaultValue={editingReminder?.quantity || 1} min="1" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" required />
          <textarea name="notes" defaultValue={editingReminder?.notes || ''} rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Observações..." />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl">Salvar</button>
        </form>
      </SaaSModal>

      <style>{` @media print { body { -webkit-print-color-adjust: exact; background: white; font-size: 10pt; } .print-hidden { display: none !important; } } `}</style>
    </div>
  );
}

function NavButton({icon, label, active, onClick, badge}: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-red-600 text-white font-black shadow-lg scale-[1.02]' : 'text-slate-500 hover:bg-red-50 hover:text-red-600 font-bold'}`}>
      <div className="flex items-center gap-3"><span>{icon}</span><span className="text-sm">{label}</span></div>
      {badge !== undefined && <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${active ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>{badge}</span>}
    </button>
  );
}

function DashboardStat({label, value, icon, trend, critical}: any) {
  return (
    <div className={`bg-white p-7 rounded-[32px] border border-slate-200 shadow-sm transition-all hover:-translate-y-1 ${critical ? 'border-red-200 bg-red-50/20' : ''}`}>
      <div className="flex justify-between items-start mb-6"><div className={`p-4 rounded-2xl ${critical ? 'bg-red-100' : 'bg-slate-50'}`}>{icon}</div><span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500">{trend}</span></div>
      <div><h2 className="text-3xl font-black text-slate-900 mb-1">{value}</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{label}</p></div>
    </div>
  );
}

function ReminderStatusBadge({ status }: { status: PartReminderStatus }) {
  const colors: any = { [PartReminderStatus.PENDING]: 'bg-red-50 text-red-700', [PartReminderStatus.ORDERED]: 'bg-blue-50 text-blue-700', [PartReminderStatus.RECEIVED]: 'bg-green-50 text-green-700' };
  return <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${colors[status] || 'bg-slate-50'}`}>{status}</span>;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const colors: any = { [OrderStatus.PENDING]: 'bg-amber-100 text-amber-800', [OrderStatus.DIAGNOSING]: 'bg-red-50 text-red-700', [OrderStatus.WAITING_APPROVAL]: 'bg-slate-100 text-slate-700', [OrderStatus.IN_REPAIR]: 'bg-blue-100 text-blue-800', [OrderStatus.READY]: 'bg-green-100 text-green-800', [OrderStatus.DELIVERED]: 'bg-slate-800 text-white' };
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
}

function SaaSModal({isOpen, onClose, title, children}: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3><button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400"><X size={20}/></button></div>
        <div className="p-10">{children}</div>
      </div>
    </div>
  );
}
