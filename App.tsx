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
  Receipt
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
import { Client, InventoryItem, ServiceOrder, OrderStatus, StatusHistoryEntry, UsedPart } from './types';
import { getPrinterDiagnosis, generateClientMessage } from './services/geminiService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'clients'>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [orders, setOrders] = useState<ServiceOrder[]>(() => {
    try {
      const saved = localStorage.getItem('printtech_orders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('printtech_inventory');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('printtech_clients');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('printtech_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('printtech_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('printtech_clients', JSON.stringify(clients));
  }, [clients]);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [printType, setPrintType] = useState<'client_individual' | 'client_general' | 'inventory' | 'os_detail' | null>(null);
  const [clientToPrint, setClientToPrint] = useState<Client | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<ServiceOrder | null>(null);

  // Estados temporários para criação de OS
  const [osPartsUsed, setOsPartsUsed] = useState<UsedPart[]>([]);

  const handleAddPartToOS = (itemId: string, qty: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    if (item.quantity < qty) {
      alert(`Quantidade insuficiente em estoque. Disponível: ${item.quantity}`);
      return;
    }

    const existing = osPartsUsed.find(p => p.inventoryItemId === itemId);
    if (existing) {
      setOsPartsUsed(osPartsUsed.map(p => 
        p.inventoryItemId === itemId ? { ...p, quantity: p.quantity + qty } : p
      ));
    } else {
      setOsPartsUsed([...osPartsUsed, {
        inventoryItemId: itemId,
        name: item.name,
        quantity: qty,
        unitPrice: item.sellPrice
      }]);
    }

    // Baixa temporária no estoque visual (será persistida ao salvar OS)
    setInventory(inventory.map(i => i.id === itemId ? { ...i, quantity: i.quantity - qty } : i));
  };

  const handleRemovePartFromOS = (itemId: string) => {
    const part = osPartsUsed.find(p => p.inventoryItemId === itemId);
    if (!part) return;

    // Devolve para o estoque
    setInventory(inventory.map(i => i.id === itemId ? { ...i, quantity: i.quantity + part.quantity } : i));
    setOsPartsUsed(osPartsUsed.filter(p => p.inventoryItemId !== itemId));
  };

  const handleExportBackup = () => {
    const backupData = { clients, inventory, orders, backupDate: new Date().toISOString(), version: "1.3.0" };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-printtech-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    alert('Backup gerado com sucesso!');
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (window.confirm('Substituir dados atuais?')) {
          setClients(data.clients || []);
          setInventory(data.inventory || []);
          setOrders(data.orders || []);
          alert('Restauração concluída!');
        }
      } catch { alert('Arquivo de backup inválido.'); }
    };
    reader.readAsText(file);
  };

  const stats = useMemo(() => {
    const revenue = orders
      .filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.READY)
      .reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
    const pending = orders.filter(o => o.status !== OrderStatus.DELIVERED).length;
    const lowStock = inventory.filter(i => i.quantity <= i.minStock).length;
    return { revenue, pending, lowStock };
  }, [orders, inventory]);

  const chartData = useMemo(() => {
    const counts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [orders]);

  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#64748b'];

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    const historyEntry: StatusHistoryEntry = { status: newStatus, date: new Date(), user: 'Técnico Admin' };
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, updatedAt: new Date(), history: [historyEntry, ...o.history] } : o));
    
    if (selectedOrder?.id === id) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus, history: [historyEntry, ...prev.history] } : null);
    }

    if (newStatus === OrderStatus.READY || newStatus === OrderStatus.DELIVERED) {
      setIsAiLoading(true);
      const target = orders.find(o => o.id === id);
      const client = clients.find(c => c.id === target?.clientId);
      const msg = await generateClientMessage(client?.name || 'Cliente', target?.printerModel || 'Impressora', newStatus, "Serviço finalizado.");
      setAiMessage(msg);
      setIsAiLoading(false);
    }
  };

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

  const handlePrint = () => {
    setTimeout(() => { window.print(); setPrintType(null); }, 100);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans print:bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm print:hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg shadow-md shadow-red-200">
            <Printer size={24} className="text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">PRINT<span className="text-red-600">TECH</span></span>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavButton icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={<Wrench size={20}/>} label="Manutenções (OS)" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavButton icon={<Package size={20}/>} label="Estoque" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavButton icon={<Users size={20}/>} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative print:p-0">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in print:space-y-4">
          
          <div className="flex justify-between items-end mb-4 print:hidden">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight capitalize">{activeTab === 'dashboard' ? 'Visão Geral' : activeTab === 'orders' ? 'Ordens de Serviço' : activeTab}</h1>
              <p className="text-slate-500 text-sm mt-1">Sua assistência técnica funcionando em alto nível.</p>
            </div>
            <div className="flex gap-3">
              {activeTab === 'orders' && (
                <button 
                  onClick={() => { setOsPartsUsed([]); setIsOrderModalOpen(true); }}
                  className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all active:scale-95"
                >
                  <PlusCircle size={20}/> Nova Manutenção
                </button>
              )}
              {activeTab === 'clients' && (
                <button onClick={() => setIsClientModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all">
                  <Plus size={20}/> Novo Cliente
                </button>
              )}
              {activeTab === 'inventory' && (
                <button onClick={() => setIsInventoryModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all">
                  <Plus size={20}/> Novo Item
                </button>
              )}
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="print:hidden space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardStat label="Faturamento Total" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<TrendingUp className="text-green-600"/>} trend="+12.5%" />
                <DashboardStat label="OS Pendentes" value={stats.pending.toString()} icon={<Clock className="text-amber-600"/>} trend="Em Processo" />
                <DashboardStat label="Peças Críticas" value={stats.lowStock.toString()} icon={<AlertTriangle className="text-red-600"/>} trend="Reposição" critical={stats.lowStock > 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-8"><BarChart3 size={18} className="text-red-600"/> Distribuição de Serviços</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                          {chartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} cornerRadius={4} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-6"><Database size={18} className="text-red-600"/> Segurança do Sistema</h3>
                  <p className="text-slate-500 text-sm mb-8">Backup preventivo de clientes, estoque e histórico de manutenções.</p>
                  <div className="grid grid-cols-1 gap-4 mt-auto">
                    <button onClick={handleExportBackup} className="w-full flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-100">
                      <Download size={20}/> Exportar Backup JSON
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all">
                      <Upload size={20}/> Restaurar Dados
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:border-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="p-6">Referência / Peça</th>
                      <th className="p-6">Saldo</th>
                      <th className="p-6">Venda</th>
                      <th className="p-6 text-center">Status</th>
                      <th className="p-6 text-right print:hidden">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6 font-bold">{i.name}</td>
                        <td className="p-6 font-black">{i.quantity} un</td>
                        <td className="p-6 font-bold text-slate-600">R$ {i.sellPrice.toFixed(2)}</td>
                        <td className="p-6 text-center">
                          {i.quantity <= i.minStock ? <span className="text-red-600 font-black text-[10px]">REPOR</span> : <span className="text-green-600 font-black text-[10px]">DISPONÍVEL</span>}
                        </td>
                        <td className="p-6 text-right print:hidden">
                          <button onClick={() => setInventory(prev => prev.filter(x => x.id !== i.id))} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="p-6">OS / Equipamento</th>
                    <th className="p-6">Cliente</th>
                    <th className="p-6">Valor Total</th>
                    <th className="p-6">Status</th>
                    <th className="p-6 text-right">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(o => (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-red-50/20 cursor-pointer group transition-colors">
                      <td className="p-6">
                        <div className="font-black text-red-600">#{o.id}</div>
                        <div className="text-sm text-slate-500">{o.printerModel}</div>
                      </td>
                      <td className="p-6 font-bold">{clients.find(c => c.id === o.clientId)?.name || 'N/A'}</td>
                      <td className="p-6 font-black text-slate-900">R$ {o.totalCost.toFixed(2)}</td>
                      <td className="p-6"><StatusBadge status={o.status}/></td>
                      <td className="p-6 text-right"><ChevronRight size={20} className="text-slate-300 group-hover:text-red-600 inline"/></td>
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
                  <tr>
                    <th className="p-6">Nome / Fantasia</th>
                    <th className="p-6">WhatsApp</th>
                    <th className="p-6 text-right">Opções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-black">{c.name}</td>
                      <td className="p-6 font-bold">{c.phone}</td>
                      <td className="p-6 text-right flex justify-end gap-2">
                         <button onClick={() => { setClientToPrint(c); setPrintType('client_individual'); handlePrint(); }} className="p-2 text-slate-400 hover:text-blue-600"><Printer size={18}/></button>
                         <button onClick={() => setClients(prev => prev.filter(x => x.id !== c.id))} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Layout de Impressão Universal */}
        <div id="print-area" className="hidden print:block font-serif text-slate-900">
          <div className="mb-8 border-b-2 border-slate-900 pb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">PRINT<span className="text-red-600">TECH</span></h1>
              <p className="text-[10px] font-bold">ASSISTÊNCIA TÉCNICA ESPECIALIZADA</p>
            </div>
            <div className="text-right text-[10px]">
              <p>Relatório Gerado em: {new Date().toLocaleString()}</p>
            </div>
          </div>

          {printType === 'os_detail' && orderToPrint && (
            <div className="space-y-8">
              <div className="flex justify-between border-b pb-4">
                <div>
                  <h2 className="text-xl font-black">ORDEM DE SERVIÇO #{orderToPrint.id}</h2>
                  <p className="text-sm">Data de Abertura: {new Date(orderToPrint.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <div className="bg-slate-900 text-white px-3 py-1 text-sm font-bold rounded uppercase">{orderToPrint.status}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs font-black uppercase mb-2 border-b">Cliente</h3>
                  <p className="text-sm font-bold">{clients.find(c => c.id === orderToPrint.clientId)?.name}</p>
                  <p className="text-xs">{clients.find(c => c.id === orderToPrint.clientId)?.phone}</p>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase mb-2 border-b">Equipamento</h3>
                  <p className="text-sm font-bold">{orderToPrint.printerModel}</p>
                  <p className="text-xs">S/N: {orderToPrint.serialNumber || 'N/A'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase mb-2 border-b">Relato Técnico / Problema</h3>
                <p className="text-sm italic">"{orderToPrint.problemDescription}"</p>
              </div>

              {orderToPrint.partsUsed.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase mb-2 border-b">Peças e Componentes</h3>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="p-2">Item</th>
                        <th className="p-2">Qtd</th>
                        <th className="p-2 text-right">V. Unit.</th>
                        <th className="p-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderToPrint.partsUsed.map((p, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-bold">{p.name}</td>
                          <td className="p-2">{p.quantity}</td>
                          <td className="p-2 text-right">R$ {p.unitPrice.toFixed(2)}</td>
                          <td className="p-2 text-right font-bold">R$ {(p.quantity * p.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t-2 pt-4 flex flex-col items-end space-y-1">
                <div className="flex justify-between w-48 text-xs">
                  <span>Mão de Obra:</span>
                  <span className="font-bold">R$ {orderToPrint.laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-xs">
                  <span>Peças:</span>
                  <span className="font-bold">R$ {orderToPrint.partsCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-lg font-black bg-slate-100 p-2 rounded">
                  <span>TOTAL:</span>
                  <span>R$ {orderToPrint.totalCost.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-20 flex justify-around">
                <div className="w-64 border-t border-slate-400 text-center text-[10px] pt-2">ASSINATURA DO TÉCNICO</div>
                <div className="w-64 border-t border-slate-400 text-center text-[10px] pt-2">ASSINATURA DO CLIENTE</div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* OS Details Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-end print:hidden">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="bg-red-100 p-3 rounded-2xl">
                  <Wrench size={28} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">OS #{selectedOrder.id}</h2>
                  <p className="text-slate-500 font-medium">{selectedOrder.printerModel}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setOrderToPrint(selectedOrder); setPrintType('os_detail'); handlePrint(); }} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600 transition-all"><Printer size={20}/></button>
                <button onClick={() => { setSelectedOrder(null); setAiMessage(''); }} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24}/></button>
              </div>
            </div>

            <div className="p-8 space-y-8 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mão de Obra</p>
                  <div className="text-xl font-black">R$ {selectedOrder.laborCost.toFixed(2)}</div>
                </div>
                <div className="bg-red-600 p-6 rounded-3xl text-white shadow-xl shadow-red-100">
                  <p className="text-[10px] font-black text-red-200 uppercase tracking-widest mb-1">Total OS</p>
                  <div className="text-xl font-black">R$ {selectedOrder.totalCost.toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><StatusBadge status={selectedOrder.status}/> Alterar Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map(s => (
                    <button 
                      key={s} 
                      onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${selectedOrder.status === s ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-red-600'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {selectedOrder.partsUsed.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Peças Utilizadas</h4>
                  <div className="space-y-2">
                    {selectedOrder.partsUsed.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white border p-4 rounded-2xl">
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{p.quantity} x R$ {p.unitPrice.toFixed(2)}</p>
                        </div>
                        <div className="font-black text-red-600">R$ {(p.quantity * p.unitPrice).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiMessage && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl animate-fade-in">
                  <p className="text-[10px] font-black text-red-600 uppercase mb-2 flex items-center gap-2"><BrainCircuit size={14}/> Comunicado IA Sugerido</p>
                  <div className="bg-white p-4 rounded-2xl text-xs font-medium italic text-red-900 border border-red-100 mb-4">"{aiMessage}"</div>
                  <button onClick={() => { navigator.clipboard.writeText(aiMessage); alert('Copiado!'); }} className="w-full bg-red-600 text-white py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2"><Copy size={14}/> Copiar e enviar ao cliente</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova OS Detalhada */}
      <SaaSModal isOpen={isOrderModalOpen} onClose={() => { setIsOrderModalOpen(false); setOsPartsUsed([]); }} title="Registrar Nova Manutenção">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const labor = parseFloat(formData.get('laborCost') as string || '0');
          const partsTotal = osPartsUsed.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
          
          const newOrder: ServiceOrder = {
            id: `OS-${Math.floor(1000 + Math.random() * 9000)}`,
            clientId: formData.get('clientId') as string,
            printerModel: formData.get('printerModel') as string,
            serialNumber: formData.get('serialNumber') as string,
            problemDescription: formData.get('problemDescription') as string,
            status: OrderStatus.PENDING,
            history: [{ status: OrderStatus.PENDING, date: new Date(), user: 'Técnico' }],
            priority: formData.get('priority') as any,
            laborCost: labor,
            partsCost: partsTotal,
            totalCost: labor + partsTotal,
            partsUsed: osPartsUsed,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setOrders(prev => [newOrder, ...prev]);
          setIsOrderModalOpen(false);
          setOsPartsUsed([]);
        }} className="space-y-6 max-h-[70vh] overflow-y-auto px-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</label>
               <select name="clientId" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" required>
                 <option value="">Selecione...</option>
                 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridade</label>
               <select name="priority" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                 <option value="Normal">Normal</option>
                 <option value="Baixa">Baixa</option>
                 <option value="Alta">Alta 🔥</option>
               </select>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="printerModel" type="text" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="Modelo Impressora" required />
            <input name="serialNumber" type="text" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="S/N de Série" />
          </div>

          <textarea name="problemDescription" rows={2} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="Descrição do Problema / Orçamento..." required />

          <div className="border-t pt-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Package size={14}/> Peças Aplicadas (Estoque)</label>
            <div className="flex gap-2 mb-4">
              <select id="part-select" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                <option value="">Escolha uma peça...</option>
                {inventory.filter(i => i.quantity > 0).map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} un - R$ {i.sellPrice.toFixed(2)})</option>)}
              </select>
              <button 
                type="button" 
                onClick={() => {
                  const sel = document.getElementById('part-select') as HTMLSelectElement;
                  if (sel.value) handleAddPartToOS(sel.value, 1);
                }}
                className="bg-slate-900 text-white px-4 rounded-xl hover:bg-red-600 transition-all"
              >
                <Plus size={20}/>
              </button>
            </div>
            
            <div className="space-y-2 mb-4">
              {osPartsUsed.map(p => (
                <div key={p.inventoryItemId} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold">{p.name} (x{p.quantity})</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-red-600">R$ {(p.quantity * p.unitPrice).toFixed(2)}</span>
                    <button type="button" onClick={() => handleRemovePartFromOS(p.inventoryItemId)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Mão de Obra (R$)</label>
              <input name="laborCost" type="number" step="0.01" className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-right" placeholder="0,00" />
            </div>
            <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Resumo Financeiro</p>
                <p className="text-xs opacity-60">Peças: R$ {osPartsUsed.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-red-500 uppercase">VALOR TOTAL ESTIMADO</p>
                <p className="text-2xl font-black">R$ {(osPartsUsed.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0) + 0).toFixed(2)}*</p>
              </div>
            </div>
          </div>

          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">Finalizar e Registrar OS</button>
        </form>
      </SaaSModal>

      {/* Restantes Modais - Originais Preservados */}
      <SaaSModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Novo Cliente">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setClients(prev => [...prev, { id: Date.now().toString(), name: formData.get('name') as string, phone: formData.get('phone') as string, email: formData.get('email') as string }]);
          setIsClientModalOpen(false);
        }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome Completo" required />
          <input name="phone" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="WhatsApp" required />
          <input name="email" type="email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Email" />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all">Salvar Cliente</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Adicionar ao Estoque">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setInventory(prev => [...prev, { id: Date.now().toString(), name: formData.get('name') as string, quantity: parseInt(formData.get('quantity') as string), minStock: parseInt(formData.get('minStock') as string), costPrice: parseFloat(formData.get('costPrice') as string), sellPrice: parseFloat(formData.get('sellPrice') as string) }]);
          setIsInventoryModalOpen(false);
        }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça" required />
          <div className="grid grid-cols-2 gap-4">
            <input name="quantity" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Qtd Inicial" required />
            <input name="minStock" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Mínimo" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input name="costPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço Custo" required />
            <input name="sellPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço Venda" required />
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all">Cadastrar Item</button>
        </form>
      </SaaSModal>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; background: white; font-size: 10pt; }
          .print-hidden { display: none !important; }
          #print-area { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function NavButton({icon, label, active, onClick}: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-red-600 text-white font-black shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-red-50 hover:text-red-600 font-bold'}`}>
      <span>{icon}</span>
      <span className="text-sm tracking-tight">{label}</span>
    </button>
  );
}

function DashboardStat({label, value, icon, trend, critical}: any) {
  return (
    <div className={`bg-white p-7 rounded-[32px] border border-slate-200 shadow-sm transition-all hover:-translate-y-1 group ${critical ? 'border-red-200 bg-red-50/20' : ''}`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${critical ? 'bg-red-100' : 'bg-slate-50 group-hover:bg-red-600/10'}`}>{icon}</div>
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${critical ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{trend}</span>
      </div>
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{value}</h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}

function SaaSModal({isOpen, onClose, title, children}: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400"><X size={20}/></button>
        </div>
        <div className="p-10">
          {children}
        </div>
      </div>
    </div>
  );
}