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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { Client, InventoryItem, ServiceOrder, OrderStatus, StatusHistoryEntry, UsedPart, PartReminder, PartReminderStatus } from './types';
import { getPrinterDiagnosis, generateClientMessage } from './services/geminiService';

// Caminho otimizado para Vite (o arquivo deve estar em public/logo.png)
const LOGO_IMAGE = '/logo.png';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'clients' | 'reminders'>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [orders, setOrders] = useState<ServiceOrder[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_orders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_inventory');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_clients');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [partReminders, setPartReminders] = useState<PartReminder[]>(() => {
    try {
      const saved = localStorage.getItem('maqara_part_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('maqara_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('maqara_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('maqara_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('maqara_part_reminders', JSON.stringify(partReminders));
  }, [partReminders]);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  
  // Estado para lembrete sendo editado
  const [editingReminder, setEditingReminder] = useState<PartReminder | null>(null);

  // Estado para a OS selecionada e sua cópia de edição (Rascunho)
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estados para o Autocomplete de Cliente
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');

  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    return clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clientSearch, clients]);

  const [aiMessage, setAiMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [printType, setPrintType] = useState<'client_individual' | 'client_general' | 'inventory' | 'os_detail' | null>(null);
  const [clientToPrint, setClientToPrint] = useState<Client | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<ServiceOrder | null>(null);

  // Ordenação dos Lembretes: Pendentes e Pedidos no topo, Recebidos no final
  const sortedReminders = useMemo(() => {
    const statusOrder = {
      [PartReminderStatus.PENDING]: 0,
      [PartReminderStatus.ORDERED]: 1,
      [PartReminderStatus.RECEIVED]: 2,
    };
    return [...partReminders].sort((a, b) => {
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [partReminders]);

  // Efeito para sincronizar editingOrder quando selectedOrder mudar
  useEffect(() => {
    if (selectedOrder) {
      setEditingOrder(JSON.parse(JSON.stringify(selectedOrder))); // Deep clone
    } else {
      setEditingOrder(null);
    }
  }, [selectedOrder]);

  const handleDeleteClient = (id: string) => {
    if (window.confirm('Excluir este cliente?')) {
      setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleDeleteOrder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Excluir esta OS permanentemente?')) {
      setOrders(prev => prev.filter(o => o.id !== id));
      if (selectedOrder?.id === id) setSelectedOrder(null);
    }
  };

  const handleDeleteInventoryItem = (id: string) => {
    if (window.confirm('Remover do estoque?')) {
      setInventory(prev => prev.filter(i => i.id !== id));
    }
  };

  // Funções para Lembretes
  const handleDeleteReminder = (id: string) => {
    if (window.confirm('Excluir este lembrete?')) {
      setPartReminders(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleUpdateReminderStatus = (id: string, status: PartReminderStatus) => {
    setPartReminders(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleSaveReminder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const partName = formData.get('partName') as string;
    const quantity = parseInt(formData.get('quantity') as string) || 1;
    const notes = formData.get('notes') as string;

    if (editingReminder) {
      setPartReminders(prev => prev.map(r => r.id === editingReminder.id ? {
        ...r,
        partName,
        quantity,
        notes
      } : r));
    } else {
      const newReminder: PartReminder = {
        id: Date.now().toString(),
        partName,
        quantity,
        notes,
        status: PartReminderStatus.PENDING,
        createdAt: new Date()
      };
      setPartReminders(prev => [newReminder, ...prev]);
    }
    
    setIsReminderModalOpen(false);
    setEditingReminder(null);
  };

  // Funções de OS rascunho
  const handleAddPartToDraft = (itemId: string, qty: number) => {
    if (!editingOrder) return;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const alreadyUsedInDraft = editingOrder.partsUsed.find(p => p.inventoryItemId === itemId)?.quantity || 0;
    if (item.quantity < alreadyUsedInDraft + qty) {
      alert('Quantidade insuficiente no estoque!');
      return;
    }
    const newPartsUsed = [...editingOrder.partsUsed];
    const existingIndex = newPartsUsed.findIndex(p => p.inventoryItemId === itemId);
    if (existingIndex > -1) {
      newPartsUsed[existingIndex] = { ...newPartsUsed[existingIndex], quantity: newPartsUsed[existingIndex].quantity + qty };
    } else {
      newPartsUsed.push({ inventoryItemId: itemId, name: item.name, quantity: qty, unitPrice: item.sellPrice });
    }
    const partsCost = newPartsUsed.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
    setEditingOrder({ ...editingOrder, partsUsed: newPartsUsed, partsCost: partsCost, totalCost: editingOrder.laborCost + partsCost });
  };

  const handleRemovePartFromDraft = (itemId: string) => {
    if (!editingOrder) return;
    const newPartsUsed = editingOrder.partsUsed.filter(p => p.inventoryItemId !== itemId);
    const partsCost = newPartsUsed.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
    setEditingOrder({ ...editingOrder, partsUsed: newPartsUsed, partsCost: partsCost, totalCost: editingOrder.laborCost + partsCost });
  };

  const handleSaveOrderChanges = async () => {
    if (!editingOrder || !selectedOrder) return;
    setIsSaving(true);
    const logs: StatusHistoryEntry[] = [];
    const timestamp = new Date();
    if (editingOrder.laborCost !== selectedOrder.laborCost) logs.push({ status: editingOrder.status, date: timestamp, user: 'Técnico', description: `Mão de obra alterada: R$ ${selectedOrder.laborCost.toFixed(2)} -> R$ ${editingOrder.laborCost.toFixed(2)}` });
    if (editingOrder.diagnosis !== selectedOrder.diagnosis) logs.push({ status: editingOrder.status, date: timestamp, user: 'Técnico', description: 'Diagnóstico técnico atualizado.' });
    
    const updatedInventory = [...inventory];
    selectedOrder.partsUsed.forEach(oldPart => { const item = updatedInventory.find(i => i.id === oldPart.inventoryItemId); if (item) item.quantity += oldPart.quantity; });
    editingOrder.partsUsed.forEach(newPart => { const item = updatedInventory.find(i => i.id === newPart.inventoryItemId); if (item) item.quantity -= newPart.quantity; });

    const updatedOrder = { ...editingOrder, history: [...logs, ...editingOrder.history], updatedAt: timestamp };
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setInventory(updatedInventory);
    setSelectedOrder(updatedOrder);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    const historyEntry: StatusHistoryEntry = { status: newStatus, date: new Date(), user: 'Técnico', description: `Status alterado para ${newStatus}` };
    const timestamp = new Date();
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, updatedAt: timestamp, history: [historyEntry, ...o.history] } : o));
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, status: newStatus, updatedAt: timestamp, history: [historyEntry, ...selectedOrder.history] });
    }
    if (newStatus === OrderStatus.READY) {
      setIsAiLoading(true);
      const target = orders.find(o => o.id === id);
      const client = clients.find(c => c.id === target?.clientId);
      const msg = await generateClientMessage(client?.name || 'Cliente', target?.printerModel || 'Impressora', newStatus, "Equipamento pronto.");
      setAiMessage(msg);
      setIsAiLoading(false);
    }
  };

  const handleExportBackup = () => {
    const backupData = { clients, inventory, orders, partReminders, backupDate: new Date().toISOString(), version: "1.8.0" };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-maqara-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setClients(data.clients || []);
        setInventory(data.inventory || []);
        setOrders(data.orders || []);
        setPartReminders(data.partReminders || []);
        alert('Dados restaurados com sucesso!');
      } catch { alert('Arquivo de backup inválido.'); }
    };
    reader.readAsText(file);
  };

  const stats = useMemo(() => {
    const revenue = orders.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.READY).reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
    const pending = orders.filter(o => o.status !== OrderStatus.DELIVERED).length;
    const lowStock = inventory.filter(i => i.quantity <= i.minStock).length;
    const pendingReminders = partReminders.filter(r => r.status === PartReminderStatus.PENDING).length;
    return { revenue, pending, lowStock, pendingReminders };
  }, [orders, inventory, partReminders]);

  const chartData = useMemo(() => {
    const counts = orders.reduce((acc, order) => { acc[order.status] = (acc[order.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [orders]);

  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#64748b'];

  const StatusBadge = ({ status }: { status: OrderStatus }) => {
    const colors: any = {
      [OrderStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
      [OrderStatus.DIAGNOSING]: 'bg-red-50 text-red-700 border-red-100',
      [OrderStatus.WAITING_APPROVAL]: 'bg-slate-100 text-slate-700 border-slate-200',
      [OrderStatus.IN_REPAIR]: 'bg-blue-100 text-blue-800 border-blue-200',
      [OrderStatus.READY]: 'bg-green-100 text-green-800 border-green-200',
      [OrderStatus.DELIVERED]: 'bg-slate-800 text-white border-slate-700',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
  };

  const ReminderStatusBadge = ({ status }: { status: PartReminderStatus }) => {
    const colors: any = {
      [PartReminderStatus.PENDING]: 'bg-red-50 text-red-700 border-red-100',
      [PartReminderStatus.ORDERED]: 'bg-blue-50 text-blue-700 border-blue-100',
      [PartReminderStatus.RECEIVED]: 'bg-green-50 text-green-700 border-green-100',
    };
    return <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${colors[status]}`}>{status}</span>;
  };

  const handlePrint = () => { setTimeout(() => { window.print(); setPrintType(null); }, 100); };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans print:bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm print:hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-center">
          <img 
            src={LOGO_IMAGE} 
            alt="MaqAra Logo" 
            className="h-16 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x60?text=MAQARA'; }}
          />
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavButton icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={<Wrench size={20}/>} label="Manutenções (OS)" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavButton icon={<Package size={20}/>} label="Estoque" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavButton icon={<Users size={20}/>} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
          <NavButton 
            icon={<Bell size={20}/>} 
            label="Lembretes de Peças" 
            active={activeTab === 'reminders'} 
            onClick={() => setActiveTab('reminders')} 
            badge={stats.pendingReminders > 0 ? stats.pendingReminders : undefined}
          />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative print:p-0">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in print:space-y-4">
          <div className="flex justify-between items-end mb-4 print:hidden">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight capitalize">
                {activeTab === 'dashboard' ? 'Visão Geral' : 
                 activeTab === 'orders' ? 'Ordens de Serviço' : 
                 activeTab === 'reminders' ? 'Lembretes de Peças' : activeTab}
              </h1>
              <p className="text-slate-500 text-sm mt-1">Gestão profissional MaqAra.</p>
            </div>
            <div className="flex gap-3">
              {activeTab === 'orders' && (
                <button onClick={() => { setClientSearch(''); setSelectedClientId(''); setIsOrderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all active:scale-95">
                  <PlusCircle size={20}/> Nova Entrada
                </button>
              )}
              {activeTab === 'reminders' && (
                <button onClick={() => { setEditingReminder(null); setIsReminderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all active:scale-95">
                  <PlusCircle size={20}/> Adicionar Lembrete
                </button>
              )}
              {activeTab === 'clients' && ( <button onClick={() => setIsClientModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all"> <Plus size={20}/> Novo Cliente </button> )}
              {activeTab === 'inventory' && ( <button onClick={() => setIsInventoryModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all"> <Plus size={20}/> Novo Item </button> )}
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="print:hidden space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <DashboardStat label="Faturamento" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<TrendingUp className="text-green-600"/>} trend="+12%" />
                <DashboardStat label="OS Ativas" value={stats.pending.toString()} icon={<Clock className="text-amber-600"/>} trend="Em Processo" />
                <DashboardStat label="Estoque Crítico" value={stats.lowStock.toString()} icon={<AlertTriangle className="text-red-600"/>} trend="Atenção" critical={stats.lowStock > 0} />
                <DashboardStat label="Peças a Pedir" value={stats.pendingReminders.toString()} icon={<ShoppingCart className="text-red-600"/>} trend="A Pedir" critical={stats.pendingReminders > 0} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-8"><BarChart3 size={18} className="text-red-600"/> Status dos Serviços</h3>
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
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-6"><Database size={18} className="text-red-600"/> Backup do Sistema</h3>
                  <p className="text-slate-500 text-sm mb-8">Exporte seus dados regularmente para garantir a segurança da MaqAra.</p>
                  <div className="grid grid-cols-1 gap-4 mt-auto">
                    <button onClick={handleExportBackup} className="w-full flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-100">
                      <Download size={20}/> Exportar Backup JSON
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all">
                      <Upload size={20}/> Importar Backup
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="p-6">Peça</th>
                    <th className="p-6">Qtd</th>
                    <th className="p-6">Data</th>
                    <th className="p-6">Status</th>
                    <th className="p-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedReminders.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-medium">Nenhum lembrete de peça cadastrado.</td></tr>
                  ) : (
                    sortedReminders.map(r => (
                      <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${r.status === PartReminderStatus.RECEIVED ? 'opacity-50' : ''}`}>
                        <td className="p-6">
                          <div className={`font-black ${r.status === PartReminderStatus.RECEIVED ? 'line-through text-slate-400' : 'text-slate-900'}`}>{r.partName}</div>
                          {r.notes && <div className="text-[10px] text-slate-500 font-medium">{r.notes}</div>}
                        </td>
                        <td className="p-6 font-black">{r.quantity} un</td>
                        <td className="p-6 text-xs text-slate-500 font-bold">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="p-6"><ReminderStatusBadge status={r.status}/></td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-2">
                            {r.status === PartReminderStatus.PENDING && (
                              <button onClick={() => handleUpdateReminderStatus(r.id, PartReminderStatus.ORDERED)} title="Pedido Realizado" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><ShoppingCart size={18}/></button>
                            )}
                            {r.status === PartReminderStatus.ORDERED && (
                              <button onClick={() => handleUpdateReminderStatus(r.id, PartReminderStatus.RECEIVED)} title="Peça Recebida" className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle size={18}/></button>
                            )}
                            <button onClick={() => { setEditingReminder(r); setIsReminderModalOpen(true); }} className="p-2 text-slate-400 hover:text-red-600"><Edit2 size={18}/></button>
                            <button onClick={() => handleDeleteReminder(r.id)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:border-none">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="p-6">Peça / Suprimento</th><th className="p-6">Saldo</th><th className="p-6">Venda</th><th className="p-6 text-center">Status</th><th className="p-6 text-right print:hidden">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map(i => (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-bold">{i.name}</td><td className="p-6 font-black">{i.quantity} un</td><td className="p-6 font-bold text-slate-600">R$ {i.sellPrice.toFixed(2)}</td>
                      <td className="p-6 text-center">{i.quantity <= i.minStock ? <span className="text-red-600 font-black text-[10px]">REPOR</span> : <span className="text-green-600 font-black text-[10px]">OK</span>}</td>
                      <td className="p-6 text-right print:hidden"><button onClick={() => handleDeleteInventoryItem(i.id)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="p-6">OS / Máquina</th><th className="p-6">Cliente</th><th className="p-6">Total</th><th className="p-6">Status</th><th className="p-6 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(o => (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-red-50/20 cursor-pointer group transition-colors">
                      <td className="p-6"><div className="font-black text-red-600">#{o.id}</div><div className="text-sm text-slate-500">{o.printerModel}</div></td>
                      <td className="p-6 font-bold">{clients.find(c => c.id === o.clientId)?.name || 'N/A'}</td><td className="p-6 font-black text-slate-900">R$ {o.totalCost.toFixed(2)}</td>
                      <td className="p-6"><StatusBadge status={o.status}/></td>
                      <td className="p-6 text-right"><div className="flex justify-end gap-2"><button onClick={(e) => handleDeleteOrder(o.id, e)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button><ChevronRight size={20} className="text-slate-300 group-hover:text-red-600 inline"/></div></td>
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
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-6 font-black">{c.name}</td><td className="p-6 font-bold text-slate-600">{c.phone}</td>
                      <td className="p-6 text-right flex justify-end gap-3"><button onClick={() => { setClientToPrint(c); setPrintType('client_individual'); handlePrint(); }} className="p-2 text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-bold uppercase"><Printer size={16}/> Relatório</button><button onClick={() => handleDeleteClient(c.id)} className="p-2 text-slate-300 hover:text-red-600 bg-slate-50 rounded-lg group-hover:bg-red-50 transition-all"><Trash2 size={18}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div id="print-area" className="hidden print:block font-serif text-slate-900">
          {printType === 'os_detail' && orderToPrint && (
            <div className="p-10 space-y-8 border-2 border-slate-900 rounded-lg">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                <div><img src={LOGO_IMAGE} alt="MaqAra Logo" className="h-16 w-auto mb-2 object-contain" /><p className="text-xs font-bold uppercase tracking-wider">ASSISTÊNCIA TÉCNICA EM IMPRESSORAS</p></div>
                <div className="text-right"><h2 className="text-xl font-black">ORDEM DE SERVIÇO #{orderToPrint.id}</h2><p className="text-sm font-bold">DATA: {new Date(orderToPrint.createdAt).toLocaleDateString()}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-1"><h3 className="text-xs font-black uppercase border-b border-slate-400 mb-2">Cliente</h3><p className="text-sm font-bold">{clients.find(c => c.id === orderToPrint.clientId)?.name}</p><p className="text-xs">FONE: {clients.find(c => c.id === orderToPrint.clientId)?.phone}</p></div>
                <div className="space-y-1"><h3 className="text-xs font-black uppercase border-b border-slate-400 mb-2">Equipamento</h3><p className="text-sm font-bold">{orderToPrint.printerModel}</p><p className="text-xs">SERIAL: {orderToPrint.serialNumber || 'N/A'}</p></div>
              </div>
              <div className="space-y-2"><h3 className="text-xs font-black uppercase border-b border-slate-400 mb-2">Defeito Relatado</h3><p className="text-sm italic p-4 bg-slate-50 rounded-lg border">"{orderToPrint.problemDescription}"</p></div>
              {orderToPrint.diagnosis && ( <div className="space-y-2"><h3 className="text-xs font-black uppercase border-b border-slate-400 mb-2">Diagnóstico Técnico</h3><p className="text-sm p-4 bg-slate-50 rounded-lg border">{orderToPrint.diagnosis}</p></div> )}
              {orderToPrint.partsUsed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase border-b border-slate-400 mb-2">Peças Utilizadas</h3>
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-100 border-b-2 border-slate-300"><th className="p-2 text-left">Item</th><th className="p-2 text-center">Qtd</th><th className="p-2 text-right">Unitário</th><th className="p-2 text-right">Total</th></tr></thead>
                    <tbody>{orderToPrint.partsUsed.map((p, i) => ( <tr key={i} className="border-b"><td className="p-2">{p.name}</td><td className="p-2 text-center">{p.quantity}</td><td className="p-2 text-right">R$ {p.unitPrice.toFixed(2)}</td><td className="p-2 text-right font-bold">R$ {(p.quantity * p.unitPrice).toFixed(2)}</td></tr> ))}</tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end pt-8">
                <div className="w-64 space-y-2 bg-slate-100 p-6 rounded-xl border-2 border-slate-900">
                  <div className="flex justify-between text-xs"><span>Mão de Obra:</span><span>R$ {orderToPrint.laborCost.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span>Total Peças:</span><span>R$ {orderToPrint.partsCost.toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg font-black pt-2 border-t border-slate-400"><span>TOTAL:</span><span>R$ {orderToPrint.totalCost.toFixed(2)}</span></div>
                </div>
              </div>
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
                <div className="bg-slate-50 p-2 rounded-xl"><img src={LOGO_IMAGE} alt="MaqAra" className="h-10 w-auto object-contain" /></div>
                <div><h2 className="text-xl font-black text-slate-900 uppercase">OS #{editingOrder.id}</h2><p className="text-slate-500 font-medium text-xs">{editingOrder.printerModel}</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setOrderToPrint(editingOrder); setPrintType('os_detail'); handlePrint(); }} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600 transition-all"><Printer size={20}/></button>
                <button onClick={() => { setSelectedOrder(null); setAiMessage(''); }} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24}/></button>
              </div>
            </div>
            <div className="p-8 space-y-8 flex-1">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><StatusBadge status={editingOrder.status}/> Gerenciar Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map(s => (
                    <button key={s} onClick={() => handleUpdateStatus(editingOrder.id, s)} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${editingOrder.status === s ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-red-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="border border-red-100 rounded-[32px] overflow-hidden bg-white shadow-sm">
                <div className="p-5 bg-red-50/50 border-b border-red-100 font-black text-[10px] uppercase tracking-widest text-red-600 flex items-center gap-2"><BrainCircuit size={16}/> Diagnóstico Técnico & Custos</div>
                <div className="p-8 space-y-6">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Relatório Técnico</label><textarea value={editingOrder.diagnosis || ''} onChange={(e) => setEditingOrder({...editingOrder, diagnosis: e.target.value})} rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm focus:border-red-400 outline-none transition-colors" placeholder="Descreva a solução aplicada..." /></div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adicionar Peças do Estoque</label>
                    <div className="flex gap-2">
                      <select id="drawer-part-select-rascunho" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"><option value="">Escolha uma peça...</option>{inventory.filter(i => i.quantity > 0).map(i => ( <option key={i.id} value={i.id}>{i.name} ({i.quantity} un - R$ {i.sellPrice.toFixed(2)})</option> ))}</select>
                      <button onClick={() => { const sel = document.getElementById('drawer-part-select-rascunho') as HTMLSelectElement; if (sel.value) handleAddPartToDraft(sel.value, 1); }} className="bg-red-600 text-white px-4 rounded-xl hover:bg-red-700 transition-all"><Plus size={20}/></button>
                    </div>
                  </div>
                  {editingOrder.partsUsed.length > 0 && (
                    <div className="space-y-2">{editingOrder.partsUsed.map((p, idx) => ( <div key={idx} className="flex justify-between items-center bg-white border p-4 rounded-2xl shadow-sm"><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-slate-400 uppercase">{p.quantity} un x R$ {p.unitPrice.toFixed(2)}</p></div><div className="flex items-center gap-3"><span className="font-black text-red-600">R$ {(p.quantity * p.unitPrice).toFixed(2)}</span><button onClick={() => handleRemovePartFromDraft(p.inventoryItemId)} className="text-slate-300 hover:text-red-600"><Trash2 size={16}/></button></div></div> ))}</div>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t"><div className="flex items-center gap-2"><Calculator size={16} className="text-slate-400"/><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mão de Obra (R$)</label></div><input type="number" step="0.01" value={editingOrder.laborCost || ''} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setEditingOrder({...editingOrder, laborCost: val, totalCost: val + editingOrder.partsCost}); }} className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-right focus:border-red-600 outline-none" /></div>
                  <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg"><div className="text-left"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Subtotal Peças</p><p className="text-lg font-bold">R$ {editingOrder.partsCost.toFixed(2)}</p></div><div className="text-right"><p className="text-[10px] font-black text-red-500 uppercase">Total Geral</p><p className="text-2xl font-black">R$ {editingOrder.totalCost.toFixed(2)}</p></div></div>
                  <button onClick={handleSaveOrderChanges} disabled={isSaving} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${saveSuccess ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-100'}`}>{isSaving ? <RefreshCcw className="animate-spin" size={20}/> : saveSuccess ? <CheckCircle size={20}/> : <Save size={20}/>}{saveSuccess ? 'Salvo com sucesso!' : 'Salvar alterações'}</button>
                </div>
              </div>
              {aiMessage && ( <div className="p-6 bg-red-50 border border-red-100 rounded-3xl animate-fade-in shadow-inner"><p className="text-[10px] font-black text-red-600 uppercase mb-2 flex items-center gap-2"><BrainCircuit size={14}/> Sugestão de Comunicação</p><div className="bg-white p-4 rounded-2xl text-xs font-medium italic text-red-900 border border-red-100 mb-4">"{aiMessage}"</div><button onClick={() => { navigator.clipboard.writeText(aiMessage); alert('Copiado!'); }} className="w-full bg-red-600 text-white py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2"><Copy size={14}/> Copiar para WhatsApp</button></div> )}
              <div className="border border-slate-100 rounded-3xl overflow-hidden">
                <div className="p-5 bg-slate-50 border-b font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2"><History size={14}/> Histórico de Eventos</div>
                <div className="p-8 space-y-6">{editingOrder.history.map((h, i) => ( <div key={i} className="flex gap-6 group"><div className="flex flex-col items-center"><div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-sm z-10"></div>{i !== editingOrder.history.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1"></div>}</div><div className="pb-4"><div className="font-black text-[10px] mb-1"><StatusBadge status={h.status}/></div>{h.description && <div className="text-xs font-medium text-slate-700 mb-1">{h.description}</div>}<div className="text-[10px] text-slate-400 font-bold">{new Date(h.date).toLocaleString()}</div></div></div> ))}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lembrete de Peça */}
      <SaaSModal isOpen={isReminderModalOpen} onClose={() => { setIsReminderModalOpen(false); setEditingReminder(null); }} title={editingReminder ? "Editar Lembrete" : "Adicionar Lembrete de Peça"}>
        <form onSubmit={handleSaveReminder} className="space-y-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Peça</label><input name="partName" type="text" defaultValue={editingReminder?.partName || ''} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" placeholder="Ex: Rolo Fusor HP 1102" required /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade Necessária</label><input name="quantity" type="number" defaultValue={editingReminder?.quantity || 1} min="1" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" required /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações (Fornecedor / Urgência)</label><textarea name="notes" defaultValue={editingReminder?.notes || ''} rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none resize-none" placeholder="Onde comprar ou nível de urgência..." /></div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">{editingReminder ? "Atualizar Lembrete" : "Salvar Lembrete"}</button>
        </form>
      </SaaSModal>

      {/* Outros Modais mantidos para integridade */}
      <SaaSModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Nova Ordem de Serviço">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); if (!selectedClientId) { alert('Selecione um cliente.'); return; } const newOrder: ServiceOrder = { id: `OS-${Math.floor(1000 + Math.random() * 9000)}`, clientId: selectedClientId, printerModel: formData.get('printerModel') as string, serialNumber: formData.get('serialNumber') as string, problemDescription: formData.get('problemDescription') as string, status: OrderStatus.PENDING, history: [{ status: OrderStatus.PENDING, date: new Date(), user: 'Recepção', description: 'Entrada do equipamento.' }], priority: formData.get('priority') as any, laborCost: 0, partsCost: 0, totalCost: 0, partsUsed: [], createdAt: new Date(), updatedAt: new Date() }; setOrders(prev => [newOrder, ...prev]); setIsOrderModalOpen(false); setClientSearch(''); setSelectedClientId(''); }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1 relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente (Buscar)</label><div className="relative"><input type="text" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); if (selectedClientId) setSelectedClientId(''); }} onFocus={() => setShowClientResults(true)} className="w-full p-4 pl-10 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" placeholder="Digite o nome..." required={!selectedClientId} /><Search className="absolute left-3 top-4 text-slate-400" size={18}/>{selectedClientId && <CheckCircle className="absolute right-3 top-4 text-green-500" size={18}/>}</div>{showClientResults && filteredClients.length > 0 && (<div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden">{filteredClients.map(c => (<div key={c.id} onClick={() => { setClientSearch(c.name); setSelectedClientId(c.id); setShowClientResults(false); }} className="p-4 hover:bg-red-50 cursor-pointer font-bold border-b last:border-0 border-slate-50 text-sm flex justify-between items-center"><span>{c.name}</span><span className="text-[10px] text-slate-400">{c.phone}</span></div>))}</div>)}</div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridade</label><select name="priority" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none"><option value="Normal">Normal</option><option value="Baixa">Baixa</option><option value="Alta">Alta 🔥</option></select></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo Equipamento</label><input name="printerModel" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" required /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Série</label><input name="serialNumber" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" /></div></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Defeito Reportado</label><textarea name="problemDescription" rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none resize-none" required /></div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">Abrir Ordem de Serviço</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Novo Cadastro de Cliente">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); setClients(prev => [...prev, { id: Date.now().toString(), name: formData.get('name') as string, phone: formData.get('phone') as string, email: formData.get('email') as string }]); setIsClientModalOpen(false); }} className="space-y-6"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome / Fantasia</label><input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" required /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label><input name="phone" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" required /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label><input name="email" type="email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none" /></div><button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all">Confirmar Cadastro</button></form>
      </SaaSModal>

      <SaaSModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Adicionar ao Estoque">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); setInventory(prev => [...prev, { id: Date.now().toString(), name: formData.get('name') as string, quantity: parseInt(formData.get('quantity') as string), minStock: parseInt(formData.get('minStock') as string), costPrice: parseFloat(formData.get('costPrice') as string), sellPrice: parseFloat(formData.get('sellPrice') as string) }]); setIsInventoryModalOpen(false); }} className="space-y-6"><input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça" required /><div className="grid grid-cols-2 gap-4"><input name="quantity" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Qtd Inicial" required /><input name="minStock" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Mínimo Alerta" required /></div><div className="grid grid-cols-2 gap-4"><input name="costPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço Custo" required /><input name="sellPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço Venda" required /></div><button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">Salvar no Estoque</button></form>
      </SaaSModal>

      <style>{` @media print { body { -webkit-print-color-adjust: exact; background: white; font-size: 10pt; } .print-hidden { display: none !important; } #print-area { display: block !important; } } `}</style>
    </div>
  );
}

function NavButton({icon, label, active, onClick, badge}: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-red-600 text-white font-black shadow-lg shadow-red-100 scale-[1.02]' : 'text-slate-500 hover:bg-red-50 hover:text-red-600 font-bold'}`}>
      <div className="flex items-center gap-3"><span>{icon}</span><span className="text-sm tracking-tight">{label}</span></div>
      {badge !== undefined && ( <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${active ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>{badge}</span> )}
    </button>
  );
}

function DashboardStat({label, value, icon, trend, critical}: any) {
  return (
    <div className={`bg-white p-7 rounded-[32px] border border-slate-200 shadow-sm transition-all hover:-translate-y-1 group ${critical ? 'border-red-200 bg-red-50/20' : ''}`}>
      <div className="flex justify-between items-start mb-6"><div className={`p-4 rounded-2xl ${critical ? 'bg-red-100' : 'bg-slate-50 group-hover:bg-red-600/10'}`}>{icon}</div><span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${critical ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{trend}</span></div>
      <div><h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{value}</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{label}</p></div>
    </div>
  );
}

function SaaSModal({isOpen, onClose, title, children}: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3><button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors"><X size={20}/></button></div>
        <div className="p-10">{children}</div>
      </div>
    </div>
  );
}