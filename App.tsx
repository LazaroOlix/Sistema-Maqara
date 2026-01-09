
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Wrench, 
  Users, 
  Package, 
  Plus, 
  BrainCircuit, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Printer,
  X,
  History,
  Trash2,
  Copy,
  BarChart3,
  TrendingUp,
  Download,
  Upload,
  Database,
  RefreshCcw,
  PlusCircle,
  Calculator,
  Save,
  Search,
  Bell,
  Check,
  Edit2,
  ShoppingCart,
  FileText
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { Client, InventoryItem, ServiceOrder, OrderStatus, PartReminder, PartReminderStatus } from './types';
import { generateClientMessage } from './services/geminiService';

const LOGO_IMAGE = '/logo.png';

// Função auxiliar para inicialização segura
const getStoredData = (key: string, defaultValue: any) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch { return defaultValue; }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'clients' | 'reminders' | 'reports'>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Refatoração para um único hook de estado para dados do sistema
  const [appData, setAppData] = useState({
    orders: getStoredData('maqara_orders', []),
    inventory: getStoredData('maqara_inventory', []),
    clients: getStoredData('maqara_clients', []),
    reminders: getStoredData('maqara_part_reminders', [])
  });

  // Destruturação para facilidade de uso
  const { orders, inventory, clients, reminders } = appData;

  // Persistência centralizada em um único useEffect
  useEffect(() => {
    localStorage.setItem('maqara_orders', JSON.stringify(orders));
    localStorage.setItem('maqara_inventory', JSON.stringify(inventory));
    localStorage.setItem('maqara_clients', JSON.stringify(clients));
    localStorage.setItem('maqara_part_reminders', JSON.stringify(reminders));
  }, [appData]);

  // Estados de UI
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
  
  // Estados de Impressão
  const [printType, setPrintType] = useState<'os' | 'client_history' | 'inventory' | null>(null);
  const [clientToPrint, setClientToPrint] = useState<Client | null>(null);

  // Memos
  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    return clients.filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clientSearch, clients]);

  const sortedReminders = useMemo(() => {
    const statusOrder = { [PartReminderStatus.PENDING]: 0, [PartReminderStatus.ORDERED]: 1, [PartReminderStatus.RECEIVED]: 2 };
    return [...reminders].sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 0;
      const orderB = statusOrder[b.status] ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reminders]);

  const stats = useMemo(() => {
    const revenue = orders.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.READY).reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
    const pending = orders.filter(o => o.status !== OrderStatus.DELIVERED).length;
    const lowStock = inventory.filter(i => i.quantity <= (i.minStock || 0)).length;
    const pendingReminders = reminders.filter(r => r.status === PartReminderStatus.PENDING).length;
    return { revenue, pending, lowStock, pendingReminders };
  }, [orders, inventory, reminders]);

  const topParts = useMemo(() => {
    const map: Record<string, { name: string, qty: number }> = {};
    orders.forEach(o => o.partsUsed?.forEach(p => {
      if (!map[p.inventoryItemId]) map[p.inventoryItemId] = { name: p.name, qty: 0 };
      map[p.inventoryItemId].qty += p.quantity;
    }));
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  const chartData = useMemo(() => {
    const counts = orders.reduce((acc, order) => { 
      const status = order.status || 'Outro';
      acc[status] = (acc[status] || 0) + 1; 
      return acc; 
    }, {} as Record<string, number>);
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [orders]);

  // Efeito para sincronizar draft de edição
  useEffect(() => {
    if (selectedOrder) setEditingOrder(JSON.parse(JSON.stringify(selectedOrder)));
    else setEditingOrder(null);
  }, [selectedOrder]);

  // Handlers de dados usando o novo estado consolidado
  const updateState = (key: string, value: any) => setAppData(prev => ({ ...prev, [key]: value }));

  const handleDeleteClient = (id: string) => { if (window.confirm('Excluir este cliente?')) updateState('clients', clients.filter(c => c.id !== id)); };
  const handleDeleteOrder = (id: string, e?: React.MouseEvent) => { if (e) e.stopPropagation(); if (window.confirm('Excluir esta OS permanentemente?')) updateState('orders', orders.filter(o => o.id !== id)); };
  const handleDeleteInventoryItem = (id: string) => { if (window.confirm('Remover do estoque?')) updateState('inventory', inventory.filter(i => i.id !== id)); };
  const handleDeleteReminder = (id: string) => { if (window.confirm('Excluir este lembrete?')) updateState('reminders', reminders.filter(r => r.id !== id)); };
  const handleUpdateReminderStatus = (id: string, status: PartReminderStatus) => { updateState('reminders', reminders.map(r => r.id === id ? { ...r, status } : r)); };

  // Fix: Added handleExportBackup to export app data as JSON for security and backup purposes
  const handleExportBackup = () => {
    const dataStr = JSON.stringify(appData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `maqara_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Fix: Added handleImportBackup to allow importing data from a JSON backup file
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.orders && json.inventory && json.clients) {
          setAppData({
            orders: json.orders || [],
            inventory: json.inventory || [],
            clients: json.clients || [],
            reminders: json.reminders || []
          });
          alert('Backup importado com sucesso!');
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch {
        alert('Erro ao ler o arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveOrderChanges = async () => {
    if (!editingOrder || !selectedOrder) return;
    setIsSaving(true);
    const updatedInv = [...inventory];
    selectedOrder.partsUsed?.forEach(p => { const item = updatedInv.find(i => i.id === p.inventoryItemId); if (item) item.quantity += p.quantity; });
    editingOrder.partsUsed?.forEach(p => { const item = updatedInv.find(i => i.id === p.inventoryItemId); if (item) item.quantity -= p.quantity; });
    
    const updatedOrder = { ...editingOrder, updatedAt: new Date() };
    updateState('orders', orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    updateState('inventory', updatedInv);
    setSelectedOrder(updatedOrder);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    const newOrders = orders.map(o => o.id === id ? { ...o, status: newStatus, updatedAt: new Date(), history: [{ status: newStatus, date: new Date(), user: 'Técnico' }, ...(o.history || [])] } : o);
    updateState('orders', newOrders);
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, status: newStatus, updatedAt: new Date(), history: [{ status: newStatus, date: new Date(), user: 'Técnico' }, ...(selectedOrder.history || [])] });
    }
  };

  // Fix: Added handleAddPartToDraft to manage adding parts from inventory to the temporary order edit state
  const handleAddPartToDraft = (itemId: string, qty: number) => {
    if (!editingOrder) return;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const currentParts = [...(editingOrder.partsUsed || [])];
    const existingPartIndex = currentParts.findIndex(p => p.inventoryItemId === itemId);
    if (existingPartIndex > -1) {
      currentParts[existingPartIndex].quantity += qty;
    } else {
      currentParts.push({
        inventoryItemId: item.id,
        name: item.name,
        quantity: qty,
        unitPrice: item.sellPrice
      });
    }
    const partsCost = currentParts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
    setEditingOrder({
      ...editingOrder,
      partsUsed: currentParts,
      partsCost,
      totalCost: (editingOrder.laborCost || 0) + partsCost
    });
  };

  // Fix: Added handleRemovePartFromDraft to manage removing parts from the temporary order edit state
  const handleRemovePartFromDraft = (itemId: string) => {
    if (!editingOrder) return;
    const currentParts = (editingOrder.partsUsed || []).filter(p => p.inventoryItemId !== itemId);
    const partsCost = currentParts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
    setEditingOrder({
      ...editingOrder,
      partsUsed: currentParts,
      partsCost,
      totalCost: (editingOrder.laborCost || 0) + partsCost
    });
  };

  // Funções de Impressão
  const handlePrintOS = (os: ServiceOrder) => {
    const client = clients.find(c => c.id === os.clientId);
    const printWindow = document.getElementById('print-area');
    if (!printWindow) return;

    printWindow.innerHTML = `
      <div class="p-8 font-sans text-slate-900 bg-white">
        <div class="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
          <div>
            <h1 class="text-3xl font-black text-red-600">MAQARA</h1>
            <p class="text-xs font-bold uppercase tracking-widest text-slate-500">Assistência Técnica de Impressoras</p>
          </div>
          <div class="text-right">
            <h2 class="text-xl font-black">ORDEM DE SERVIÇO</h2>
            <p class="text-lg font-black text-red-600">#${os.id}</p>
            <p class="text-xs font-medium">${new Date(os.createdAt).toLocaleDateString()} ${new Date(os.createdAt).toLocaleTimeString()}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 class="text-[10px] font-black uppercase text-slate-400 mb-2 border-b">Dados do Cliente</h3>
            <p class="font-bold">${client?.name || 'Cliente não cadastrado'}</p>
            <p class="text-sm">Tel: ${client?.phone || 'N/A'}</p>
            <p class="text-sm">Email: ${client?.email || 'N/A'}</p>
          </div>
          <div>
            <h3 class="text-[10px] font-black uppercase text-slate-400 mb-2 border-b">Equipamento</h3>
            <p class="font-bold">${os.printerModel}</p>
            <p class="text-sm">Série: ${os.serialNumber || 'N/A'}</p>
            <p class="text-sm">Prioridade: ${os.priority}</p>
          </div>
        </div>

        <div class="mb-8">
          <h3 class="text-[10px] font-black uppercase text-slate-400 mb-2 border-b">Relato do Problema</h3>
          <p class="text-sm p-4 bg-slate-50 border rounded-lg italic">"${os.problemDescription}"</p>
        </div>

        <div class="mb-8">
          <h3 class="text-[10px] font-black uppercase text-slate-400 mb-2 border-b">Diagnóstico e Serviço Realizado</h3>
          <p class="text-sm p-4 bg-slate-50 border rounded-lg">${os.diagnosis || 'Serviço em andamento.'}</p>
        </div>

        <div class="mb-8">
          <h3 class="text-[10px] font-black uppercase text-slate-400 mb-2 border-b">Peças e Materiais</h3>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-100">
                <th class="p-2 text-left">Item</th>
                <th class="p-2 text-center">Qtd</th>
                <th class="p-2 text-right">Unitário</th>
                <th class="p-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(os.partsUsed || []).map(p => `
                <tr class="border-b">
                  <td class="p-2">${p.name}</td>
                  <td class="p-2 text-center">${p.quantity}</td>
                  <td class="p-2 text-right">R$ ${p.unitPrice.toFixed(2)}</td>
                  <td class="p-2 text-right font-bold">R$ ${(p.quantity * p.unitPrice).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex justify-end mb-12">
          <div class="w-64 space-y-2 p-4 bg-slate-50 border-2 border-slate-900 rounded-xl">
            <div class="flex justify-between text-xs font-bold"><span>Mão de Obra:</span> <span>R$ ${os.laborCost.toFixed(2)}</span></div>
            <div class="flex justify-between text-xs font-bold"><span>Total Peças:</span> <span>R$ ${os.partsCost.toFixed(2)}</span></div>
            <div class="flex justify-between text-xl font-black pt-2 border-t border-slate-900 text-red-600"><span>TOTAL:</span> <span>R$ ${os.totalCost.toFixed(2)}</span></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-20 pt-10">
          <div class="text-center border-t-2 border-slate-900 pt-2">
            <p class="text-[10px] font-black uppercase">Responsável Técnico</p>
          </div>
          <div class="text-center border-t-2 border-slate-900 pt-2">
            <p class="text-[10px] font-black uppercase">Assinatura do Cliente</p>
          </div>
        </div>
      </div>
    `;
    window.print();
  };

  const handlePrintClientHistory = (client: Client) => {
    const clientOrders = orders.filter(o => o.clientId === client.id);
    const totalSpent = clientOrders.reduce((acc, o) => acc + o.totalCost, 0);
    const printWindow = document.getElementById('print-area');
    if (!printWindow) return;

    printWindow.innerHTML = `
      <div class="p-8 font-sans text-slate-900 bg-white">
        <div class="flex justify-between items-center mb-8 border-b-2 pb-4">
          <div><h1 class="text-2xl font-black">HISTÓRICO DO CLIENTE</h1><p class="font-bold text-red-600">${client.name}</p></div>
          <div class="text-right text-xs">Impresso em: ${new Date().toLocaleDateString()}</div>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-100 border-b">
              <th class="p-2 text-left">OS</th>
              <th class="p-2 text-left">Equipamento</th>
              <th class="p-2 text-left">Data</th>
              <th class="p-2 text-left">Status</th>
              <th class="p-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${clientOrders.map(o => `
              <tr class="border-b">
                <td class="p-2 font-bold">#${o.id}</td>
                <td class="p-2">${o.printerModel}</td>
                <td class="p-2">${new Date(o.createdAt).toLocaleDateString()}</td>
                <td class="p-2">${o.status}</td>
                <td class="p-2 text-right">R$ ${o.totalCost.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-slate-50 font-black">
              <td colspan="4" class="p-4 text-right uppercase">Total Acumulado:</td>
              <td class="p-4 text-right text-lg text-red-600">R$ ${totalSpent.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    window.print();
  };

  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#64748b'];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans print:bg-white">
      {/* Sidebar - Oculto na impressão */}
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
          <NavButton icon={<BarChart3 size={20}/>} label="Relatórios" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative print:p-0">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in print:hidden">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {activeTab === 'dashboard' ? 'Visão Geral' : activeTab === 'orders' ? 'Ordens de Serviço' : activeTab === 'reminders' ? 'Lembretes de Peças' : activeTab === 'inventory' ? 'Estoque' : activeTab === 'clients' ? 'Clientes' : 'Relatórios Gerenciais'}
              </h1>
            </div>
            <div className="flex gap-3">
              {activeTab === 'orders' && <button onClick={() => { setClientSearch(''); setSelectedClientId(''); setIsOrderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Nova OS</button>}
              {activeTab === 'clients' && <button onClick={() => setIsClientModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Cliente</button>}
              {activeTab === 'inventory' && <button onClick={() => setIsInventoryModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Item</button>}
              {activeTab === 'reminders' && <button onClick={() => { setEditingReminder(null); setIsReminderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Lembrete</button>}
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
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-8"><BarChart3 size={18}/> Distribuição de Status</h3>
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
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-6"><Database size={18}/> Backup e Segurança</h3>
                  <button onClick={handleExportBackup} className="w-full flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-2xl font-black mb-4"><Download size={20}/> Exportar JSON</button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl font-black"><Upload size={20}/> Importar JSON</button>
                  <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><FileText size={18} className="text-red-600"/> Peças Mais Utilizadas</h3>
                    <button onClick={() => window.print()} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 flex items-center gap-2 transition-all"><Printer size={16}/> Imprimir Tudo</button>
                  </div>
                  <div className="space-y-4">
                    {topParts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 bg-red-600 text-white flex items-center justify-center rounded-lg font-black text-xs">{i+1}</span>
                          <span className="font-bold">{p.name}</span>
                        </div>
                        <span className="font-black text-red-600">{p.qty} un</span>
                      </div>
                    ))}
                    {topParts.length === 0 && <p className="text-center py-10 text-slate-400 italic">Nenhum dado de peças utilizado ainda.</p>}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="font-black text-slate-800 mb-6">Métricas de Faturamento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                      <p className="text-[10px] font-black uppercase text-green-600 mb-1">Total Finalizado</p>
                      <p className="text-2xl font-black text-green-700">R$ {stats.revenue.toFixed(2)}</p>
                    </div>
                    <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                      <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Ticket Médio (OS)</p>
                      <p className="text-2xl font-black text-amber-700">R$ {orders.length > 0 ? (stats.revenue / orders.length).toFixed(2) : '0.00'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl">
                  <h3 className="font-black text-red-600 mb-4 flex items-center gap-2"><History size={18}/> Saúde do Negócio</h3>
                  <div className="space-y-6">
                    <div><p className="text-xs text-slate-400 font-bold uppercase mb-2">Total de Ordens</p><p className="text-3xl font-black">{orders.length}</p></div>
                    <div><p className="text-xs text-slate-400 font-bold uppercase mb-2">Clientes Cadastrados</p><p className="text-3xl font-black">{clients.length}</p></div>
                    <div className="pt-4 border-t border-slate-800"><p className="text-[10px] font-black uppercase text-slate-500 mb-4">Eficiência de Reparo</p><div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden"><div className="bg-red-600 h-full" style={{ width: `${(orders.filter(o => o.status === OrderStatus.READY || o.status === OrderStatus.DELIVERED).length / (orders.length || 1) * 100)}%` }}></div></div><p className="text-right text-[10px] font-bold mt-2 text-slate-400">{(orders.filter(o => o.status === OrderStatus.READY || o.status === OrderStatus.DELIVERED).length / (orders.length || 1) * 100).toFixed(0)}% de conclusão</p></div>
                  </div>
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
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-medium italic">Nenhuma ordem de serviço cadastrada no momento.</td></tr>
                  ) : orders?.map(o => (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-red-50/20 cursor-pointer group transition-colors">
                      <td className="p-6"><div className="font-black text-red-600">#{o.id}</div><div className="text-sm text-slate-500 font-medium">{o.printerModel}</div></td>
                      <td className="p-6 font-bold">{clients?.find(c => c.id === o.clientId)?.name || 'N/A'}</td>
                      <td className="p-6 font-black text-slate-900">R$ {(o.totalCost || 0).toFixed(2)}</td>
                      <td className="p-6"><StatusBadge status={o.status}/></td>
                      <td className="p-6 text-right"><div className="flex justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); handlePrintOS(o); }} className="p-2 text-slate-400 hover:text-red-600"><Printer size={18}/></button><button onClick={(e) => handleDeleteOrder(o.id, e)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button><ChevronRight size={20} className="text-slate-300 group-hover:text-red-600 inline ml-2"/></div></td>
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
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic">Estoque vazio.</td></tr>
                  ) : inventory?.map(i => (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-bold">{i.name}</td>
                      <td className="p-6 font-black">{i.quantity} un</td>
                      <td className="p-6 font-bold text-slate-600">R$ {(i.sellPrice || 0).toFixed(2)}</td>
                      <td className="p-6 text-center">
                        {i.quantity <= (i.minStock || 0) ? <span className="text-red-600 font-black text-[10px] bg-red-50 px-2 py-1 rounded-lg">REPOR</span> : <span className="text-green-600 font-black text-[10px] bg-green-50 px-2 py-1 rounded-lg">OK</span>}
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
                    <tr><td colSpan={3} className="p-20 text-center text-slate-400 italic">Nenhum cliente cadastrado.</td></tr>
                  ) : clients?.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-6 font-black">{c.name}</td>
                      <td className="p-6 font-bold text-slate-600">{c.phone}</td>
                      <td className="p-6 text-right flex justify-end gap-3">
                        <button onClick={() => handlePrintClientHistory(c)} className="p-2 text-slate-400 hover:text-blue-600 flex items-center gap-1 text-[10px] font-black uppercase"><History size={16}/> Histórico</button>
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
              <div className="flex gap-2">
                <button onClick={() => handlePrintOS(editingOrder)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600 transition-all"><Printer size={20}/></button>
                <button onClick={() => { setSelectedOrder(null); }} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24}/></button>
              </div>
            </div>
            <div className="p-8 space-y-8 flex-1">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Atualizar Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map(s => (
                    <button key={s} onClick={() => handleUpdateStatus(editingOrder.id, s)} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${editingOrder.status === s ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="border border-red-100 rounded-[32px] overflow-hidden bg-white shadow-sm">
                <div className="p-5 bg-red-50/50 border-b border-red-100 font-black text-[10px] uppercase tracking-widest text-red-600 flex items-center gap-2"><BrainCircuit size={16}/> Diagnóstico Técnico</div>
                <div className="p-8 space-y-6">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relatório Final</label><textarea value={editingOrder.diagnosis || ''} onChange={(e) => setEditingOrder({...editingOrder, diagnosis: e.target.value})} rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Solução aplicada..." /></div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adicionar Peças do Estoque</label>
                    <div className="flex gap-2">
                      <select id="part-select" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"><option value="">Peça...</option>{inventory?.filter(i => i.quantity > 0).map(i => ( <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option> ))}</select>
                      <button onClick={() => { const sel = document.getElementById('part-select') as HTMLSelectElement; if (sel.value) handleAddPartToDraft(sel.value, 1); }} className="bg-red-600 text-white px-4 rounded-xl"><Plus size={20}/></button>
                    </div>
                  </div>
                  {editingOrder.partsUsed?.length > 0 && (
                    <div className="space-y-2">{editingOrder.partsUsed.map((p, idx) => ( <div key={idx} className="flex justify-between items-center bg-white border p-4 rounded-2xl shadow-sm"><div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-slate-400 uppercase">{p.quantity} un</p></div><button onClick={() => handleRemovePartFromDraft(p.inventoryItemId)} className="text-slate-300"><Trash2 size={16}/></button></div> ))}</div>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calculator size={14}/> Mão de Obra</label><input type="number" step="0.01" value={editingOrder.laborCost || ''} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setEditingOrder({...editingOrder, laborCost: val, totalCost: val + editingOrder.partsCost}); }} className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-right" /></div>
                  <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg"><div className="text-left"><p className="text-[10px] uppercase font-black">Subtotal</p><p className="text-lg font-bold">R$ {(editingOrder.partsCost || 0).toFixed(2)}</p></div><div className="text-right"><p className="text-[10px] uppercase font-black text-red-500">Total Final</p><p className="text-2xl font-black">R$ {(editingOrder.totalCost || 0).toFixed(2)}</p></div></div>
                  <button onClick={handleSaveOrderChanges} disabled={isSaving} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 ${saveSuccess ? 'bg-green-600 text-white' : 'bg-red-600 text-white shadow-xl'}`}>{isSaving ? <RefreshCcw className="animate-spin" size={20}/> : saveSuccess ? <CheckCircle size={20}/> : <Save size={20}/>}{saveSuccess ? 'Salvo com Sucesso!' : 'Salvar Alterações'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modais omitidos para brevidade, usar SaaSModal padrão */}
      <SaaSModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Nova OS">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); if (!selectedClientId) return; const newOrder: ServiceOrder = { id: `OS-${Math.floor(1000 + Math.random() * 9000)}`, clientId: selectedClientId, printerModel: formData.get('printerModel') as string, serialNumber: formData.get('serialNumber') as string, problemDescription: formData.get('problemDescription') as string, status: OrderStatus.PENDING, history: [{ status: OrderStatus.PENDING, date: new Date(), user: 'Recepção' }], priority: 'Normal', laborCost: 0, partsCost: 0, totalCost: 0, partsUsed: [], createdAt: new Date(), updatedAt: new Date() }; updateState('orders', [newOrder, ...orders]); setIsOrderModalOpen(false); setClientSearch(''); setSelectedClientId(''); }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 relative"><label className="text-[10px] font-black uppercase">Buscar Cliente</label><input type="text" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); if (selectedClientId) setSelectedClientId(''); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome..." />{showClientResults && filteredClients.length > 0 && (<div className="absolute top-full left-0 right-0 z-[210] mt-2 bg-white border rounded-2xl shadow-2xl max-h-48 overflow-y-auto">{filteredClients.map(c => (<div key={c.id} onClick={() => { setClientSearch(c.name); setSelectedClientId(c.id); setShowClientResults(false); }} className="p-4 hover:bg-red-50 cursor-pointer font-bold border-b">{c.name}</div>))}</div>)}</div>
            <div className="space-y-1"><label className="text-[10px] font-black uppercase">Modelo</label><input name="printerModel" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" required /></div>
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Criar OS</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Novo Cliente">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); updateState('clients', [...clients, { id: Date.now().toString(), name: formData.get('name') as string, phone: formData.get('phone') as string, email: formData.get('email') as string }]); setIsClientModalOpen(false); }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome Completo" required />
          <input name="phone" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="WhatsApp" required />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Cadastrar</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Novo Item">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); updateState('inventory', [...inventory, { id: Date.now().toString(), name: formData.get('name') as string, quantity: parseInt(formData.get('quantity') as string), minStock: parseInt(formData.get('minStock') as string), costPrice: parseFloat(formData.get('costPrice') as string), sellPrice: parseFloat(formData.get('sellPrice') as string) }]); setIsInventoryModalOpen(false); }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça" required />
          <div className="grid grid-cols-2 gap-4"><input name="quantity" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Qtd" required /><input name="minStock" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Mínimo" /></div>
          <input name="sellPrice" type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço Venda" required />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Salvar</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isReminderModalOpen} onClose={() => setIsReminderModalOpen(false)} title={editingReminder ? "Editar Lembrete" : "Novo Lembrete"}>
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); const reminderData = { partName: formData.get('partName') as string, quantity: parseInt(formData.get('quantity') as string), notes: formData.get('notes') as string, status: editingReminder ? editingReminder.status : PartReminderStatus.PENDING }; if (editingReminder) { updateState('reminders', reminders.map(r => r.id === editingReminder.id ? { ...r, ...reminderData } : r)); } else { updateState('reminders', [{ id: Date.now().toString(), ...reminderData, createdAt: new Date() }, ...reminders]); } setIsReminderModalOpen(false); }} className="space-y-6">
          <input name="partName" defaultValue={editingReminder?.partName} type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça" required />
          <input name="quantity" defaultValue={editingReminder?.quantity} type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Quantidade" required />
          <textarea name="notes" defaultValue={editingReminder?.notes} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Observações (opcional)" rows={3}></textarea>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">{editingReminder ? 'Atualizar' : 'Criar Lembrete'}</button>
        </form>
      </SaaSModal>
    </div>
  );
}

// Subcomponentes Refatorados
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
