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
  ShieldCheck
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
import { Client, InventoryItem, ServiceOrder, OrderStatus, StatusHistoryEntry } from './types';
import { getPrinterDiagnosis, generateClientMessage } from './services/geminiService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'clients'>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Persistência definitiva: Se não houver nada no localStorage, inicia vazio conforme regra.
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

  // Salvar automaticamente sempre que houver mudanças
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

  const [printType, setPrintType] = useState<'client_individual' | 'client_general' | 'inventory' | null>(null);
  const [clientToPrint, setClientToPrint] = useState<Client | null>(null);

  // Lógica de Backup (Download JSON)
  const handleExportBackup = () => {
    const backupData = {
      clients,
      inventory,
      orders,
      backupDate: new Date().toISOString(),
      version: "1.2.0"
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    
    link.href = url;
    link.download = `backup-printtech-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('Backup gerado com sucesso!');
  };

  // Lógica de Restore (Upload JSON)
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validação básica da estrutura
        if (!data.clients || !data.inventory || !data.orders) {
          throw new Error('Estrutura de arquivo inválida.');
        }

        if (window.confirm('Isso substituirá todos os dados atuais pelos dados do backup. Deseja continuar?')) {
          setClients(data.clients);
          setInventory(data.inventory);
          setOrders(data.orders);
          alert('Sistema restaurado com sucesso!');
        }
      } catch (err) {
        alert('Erro ao processar backup: Arquivo inválido ou corrompido.');
        console.error(err);
      }
      // Limpar input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Estatísticas
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
    const baseData = Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
    return baseData.length > 0 ? baseData : [{ name: 'Sem Dados', value: 1 }];
  }, [orders]);

  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#64748b'];

  const handleDeleteOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Excluir esta Ordem de Serviço permanentemente?')) {
      setOrders(prev => prev.filter(o => o.id !== id));
      if (selectedOrder?.id === id) setSelectedOrder(null);
    }
  };

  const handleDeleteClient = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Excluir este cliente?')) {
      setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleDeleteInventoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Remover esta peça do estoque?')) {
      setInventory(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    const historyEntry: StatusHistoryEntry = { status: newStatus, date: new Date(), user: 'Técnico Admin' };
    let targetOrder: ServiceOrder | undefined;

    setOrders(prev => prev.map(o => {
      if (o.id === id) {
        targetOrder = { ...o, status: newStatus, updatedAt: new Date(), history: [historyEntry, ...o.history] };
        return targetOrder;
      }
      return o;
    }));

    if (selectedOrder?.id === id) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus, history: [historyEntry, ...prev.history] } : null);
    }

    if (targetOrder && (newStatus === OrderStatus.READY || newStatus === OrderStatus.DELIVERED)) {
      setIsAiLoading(true);
      const client = clients.find(c => c.id === targetOrder?.clientId);
      const msg = await generateClientMessage(
        client?.name || 'Cliente',
        targetOrder.printerModel,
        newStatus,
        newStatus === OrderStatus.READY ? "Equipamento disponível para retirada." : "Serviço finalizado com sucesso."
      );
      setAiMessage(msg);
      setIsAiLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: OrderStatus }) => {
    const colors: any = {
      [OrderStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
      [OrderStatus.DIAGNOSING]: 'bg-red-50 text-red-700 border-red-100',
      [OrderStatus.WAITING_APPROVAL]: 'bg-slate-100 text-slate-700 border-slate-200',
      [OrderStatus.READY]: 'bg-green-100 text-green-800 border-green-200',
      [OrderStatus.DELIVERED]: 'bg-slate-800 text-white border-slate-700',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
      setPrintType(null);
      setClientToPrint(null);
    }, 100);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans print:bg-white">
      {/* Sidebar - Oculta na Impressão */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm print:hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg shadow-md shadow-red-200">
            <Printer size={24} className="text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">PRINT<span className="text-red-600">TECH</span></span>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavButton icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={<Wrench size={20}/>} label="Ordens de Serviço" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavButton icon={<Package size={20}/>} label="Estoque" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavButton icon={<Users size={20}/>} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative print:p-0">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in print:space-y-4">
          
          {/* Header Section - Oculto na Impressão */}
          <div className="flex justify-between items-end mb-4 print:hidden">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight capitalize">{activeTab === 'dashboard' ? 'Visão Geral' : activeTab}</h1>
              <p className="text-slate-500 text-sm mt-1">Gestão inteligente e segura dos seus dados.</p>
            </div>
            <div className="flex gap-3">
              {activeTab === 'inventory' && (
                <button onClick={() => { setPrintType('inventory'); handlePrint(); }} className="bg-white text-slate-700 px-5 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2">
                  <Printer size={18}/> Imprimir Estoque
                </button>
              )}
              {activeTab === 'clients' && (
                <button onClick={() => { setPrintType('client_general'); handlePrint(); }} className="bg-white text-slate-700 px-5 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2">
                  <Printer size={18}/> Relatório Geral
                </button>
              )}
              {activeTab !== 'dashboard' && (
                <button 
                  onClick={() => activeTab === 'orders' ? setIsOrderModalOpen(true) : activeTab === 'clients' ? setIsClientModalOpen(true) : setIsInventoryModalOpen(true)}
                  className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus size={20}/> Adicionar
                </button>
              )}
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="print:hidden space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardStat label="Receita Líquida" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<TrendingUp className="text-green-600"/>} trend="+12.5%" />
                <DashboardStat label="OS em Aberto" value={stats.pending.toString()} icon={<Clock className="text-amber-600"/>} trend="Pendentes" />
                <DashboardStat label="Alerta Estoque" value={stats.lowStock.toString()} icon={<AlertTriangle className="text-red-600"/>} trend="Reposição" critical={stats.lowStock > 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-8"><BarChart3 size={18} className="text-red-600"/> Status das Ordens</h3>
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

                {/* Gestão de Dados (Backup/Restore) */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 mb-6"><Database size={18} className="text-red-600"/> Segurança de Dados</h3>
                  <p className="text-slate-500 text-sm mb-8">O sistema salva os dados localmente no seu navegador. Recomendamos exportar um backup regularmente.</p>
                  
                  <div className="grid grid-cols-1 gap-4 mt-auto">
                    <button 
                      onClick={handleExportBackup}
                      className="w-full flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                    >
                      <Download size={20}/> Fazer Backup Completo
                    </button>
                    
                    <div className="relative">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportBackup} 
                        accept=".json" 
                        className="hidden" 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all"
                      >
                        <Upload size={20}/> Restaurar Backup (.json)
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3 text-slate-400">
                    <ShieldCheck size={20} className="text-green-500"/>
                    <span className="text-xs font-bold uppercase tracking-widest">Proteção Local Ativa</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 print:bg-white">
                    <tr>
                      <th className="p-6">Item</th>
                      <th className="p-6">Qtd</th>
                      <th className="p-6">Custo</th>
                      <th className="p-6">Venda</th>
                      <th className="p-6">Mín.</th>
                      <th className="p-6 text-center">Status</th>
                      <th className="p-6 text-right print:hidden">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-20 text-center text-slate-400 italic">Nenhum item em estoque.</td>
                      </tr>
                    )}
                    {inventory.map(i => {
                      const isLow = i.quantity <= i.minStock;
                      return (
                        <tr key={i.id} className={`hover:bg-slate-50 transition-colors ${isLow ? 'bg-red-50/30 print:bg-white' : ''}`}>
                          <td className="p-6">
                            <div className="font-bold text-slate-900">{i.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">REF: {i.id.slice(-6)}</div>
                          </td>
                          <td className="p-6 font-black">{i.quantity}</td>
                          <td className="p-6 text-sm text-slate-500">R$ {i.costPrice.toFixed(2)}</td>
                          <td className="p-6 text-sm font-bold">R$ {i.sellPrice.toFixed(2)}</td>
                          <td className="p-6 text-sm text-slate-400">{i.minStock}</td>
                          <td className="p-6 text-center">
                            {isLow ? <span className="text-red-600 font-black text-[10px] uppercase">BAIXO</span> : <span className="text-green-600 font-black text-[10px] uppercase">OK</span>}
                          </td>
                          <td className="p-6 text-right print:hidden">
                            <button onClick={(e) => handleDeleteInventoryItem(i.id, e)} className="p-2.5 text-slate-300 hover:text-red-600 rounded-xl"><Trash2 size={20}/></button>
                          </td>
                        </tr>
                      );
                    })}
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
                    <th className="p-6">Protocolo / Máquina</th>
                    <th className="p-6">Cliente</th>
                    <th className="p-6">Status</th>
                    <th className="p-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-20 text-center text-slate-400 italic">Nenhuma ordem de serviço.</td>
                    </tr>
                  )}
                  {orders.map(o => (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-red-50/20 cursor-pointer transition-colors group">
                      <td className="p-6">
                        <div className="font-black text-red-600 text-lg">#{o.id}</div>
                        <div className="text-sm font-medium text-slate-500">{o.printerModel}</div>
                      </td>
                      <td className="p-6 font-bold">{clients.find(c => c.id === o.clientId)?.name || 'Cliente Removido'}</td>
                      <td className="p-6"><StatusBadge status={o.status}/></td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-3 items-center">
                          <button onClick={(e) => handleDeleteOrder(o.id, e)} className="p-2.5 text-slate-300 hover:text-red-600 rounded-xl"><Trash2 size={20}/></button>
                          <ChevronRight size={20} className="text-slate-300 group-hover:text-red-600" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:border-none">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 print:bg-white">
                  <tr>
                    <th className="p-6">Nome Completo</th>
                    <th className="p-6">WhatsApp</th>
                    <th className="p-6 text-right print:hidden">Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-20 text-center text-slate-400 italic">Nenhum cliente cadastrado.</td>
                    </tr>
                  )}
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-black text-slate-900">{c.name}</td>
                      <td className="p-6 font-bold text-slate-600">{c.phone}</td>
                      <td className="p-6 text-right print:hidden flex justify-end gap-2">
                        <button onClick={() => { setClientToPrint(c); setPrintType('client_individual'); handlePrint(); }} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl flex items-center gap-1 text-xs font-bold transition-all"><FileText size={18}/> Imprimir Ficha</button>
                        <button onClick={(e) => handleDeleteClient(c.id, e)} className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Layout de Impressão */}
        <div id="print-area" className="hidden print:block font-serif text-slate-900 bg-white">
          <div className="mb-8 border-b-2 border-slate-900 pb-4 flex justify-between items-center">
             <div>
               <h1 className="text-2xl font-black uppercase">PRINT<span className="text-red-600">TECH</span> Assistência</h1>
               <p className="text-xs font-bold">Gestão Profissional de Dados</p>
             </div>
             <div className="text-right text-[10px]">
               <p>Emissão: {new Date().toLocaleString()}</p>
             </div>
          </div>

          {printType === 'client_individual' && clientToPrint && (
            <div className="space-y-6">
               <div className="bg-slate-100 p-4 rounded-lg">
                 <h2 className="text-lg font-black uppercase mb-2">Ficha Cadastral do Cliente</h2>
                 <p><strong>Nome:</strong> {clientToPrint.name}</p>
                 <p><strong>WhatsApp:</strong> {clientToPrint.phone}</p>
                 <p><strong>Email:</strong> {clientToPrint.email || 'Não informado'}</p>
               </div>
               
               <h3 className="text-md font-black border-b border-slate-300 pb-1">Histórico de Ordens de Serviço</h3>
               <table className="w-full text-xs">
                 <thead className="bg-slate-50">
                   <tr className="border-b">
                     <th className="p-2 text-left">Protocolo</th>
                     <th className="p-2 text-left">Equipamento</th>
                     <th className="p-2 text-left">Data</th>
                     <th className="p-2 text-left">Status Final</th>
                     <th className="p-2 text-right">Valor Total</th>
                   </tr>
                 </thead>
                 <tbody>
                   {orders.filter(o => o.clientId === clientToPrint.id).map(o => (
                     <tr key={o.id} className="border-b">
                       <td className="p-2 font-bold">#{o.id}</td>
                       <td className="p-2">{o.printerModel}</td>
                       <td className="p-2">{new Date(o.createdAt).toLocaleDateString()}</td>
                       <td className="p-2 font-bold">{o.status}</td>
                       <td className="p-2 text-right font-bold">R$ {o.totalCost.toFixed(2)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          )}

          {printType === 'client_general' && (
            <div className="space-y-4">
              <h2 className="text-lg font-black uppercase">Relatório Geral de Clientes</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-400 bg-slate-50">
                    <th className="p-3 text-left">Nome do Cliente</th>
                    <th className="p-3 text-left">Contato WhatsApp</th>
                    <th className="p-3 text-left">E-mail</th>
                    <th className="p-3 text-center">Total OS</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-b border-slate-200">
                      <td className="p-3 font-bold">{c.name}</td>
                      <td className="p-3">{c.phone}</td>
                      <td className="p-3">{c.email || '-'}</td>
                      <td className="p-3 text-center">{orders.filter(o => o.clientId === c.id).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {printType === 'inventory' && (
            <div className="space-y-4">
              <h2 className="text-lg font-black uppercase">Relatório de Estoque e Reposição</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-400 bg-slate-50">
                    <th className="p-3 text-left">Referência / Item</th>
                    <th className="p-3 text-center">Qtd Atual</th>
                    <th className="p-3 text-center">Nível Mín.</th>
                    <th className="p-3 text-right">Preço Venda</th>
                    <th className="p-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(i => (
                    <tr key={i.id} className={`border-b border-slate-200 ${i.quantity <= i.minStock ? 'bg-red-50 text-red-900 font-bold' : ''}`}>
                      <td className="p-3">{i.name}</td>
                      <td className="p-3 text-center">{i.quantity}</td>
                      <td className="p-3 text-center">{i.minStock}</td>
                      <td className="p-3 text-right">R$ {i.sellPrice.toFixed(2)}</td>
                      <td className="p-3 text-center uppercase font-black">{i.quantity <= i.minStock ? 'REPOR' : 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <Printer size={28} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">OS #{selectedOrder.id}</h2>
                  <p className="text-slate-500 font-medium">{selectedOrder.printerModel}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedOrder(null); setAiMessage(''); }} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24}/></button>
            </div>

            <div className="p-8 space-y-8 flex-1">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mudar Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map(s => (
                    <button 
                      key={s} 
                      onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black border transition-all ${selectedOrder.status === s ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {(aiMessage || isAiLoading) && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl animate-fade-in relative overflow-hidden shadow-sm">
                   <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-red-700 font-black text-sm uppercase"><BrainCircuit size={18}/> IA Suggestion</div>
                    <button onClick={() => { navigator.clipboard.writeText(aiMessage); alert('Copiado!'); }} className="text-[10px] font-black bg-white text-red-700 px-3 py-2 rounded-xl border border-red-200"><Copy size={12}/> Copiar</button>
                  </div>
                  {isAiLoading ? (
                    <div className="flex items-center gap-3 text-red-600 text-xs py-4 font-bold uppercase tracking-widest animate-pulse text-center w-full">Gerando mensagem personalizada...</div>
                  ) : (
                    <div>
                      <div className="bg-white/60 p-4 rounded-2xl mb-4 border border-red-100">
                        <p className="text-sm text-red-900 font-medium italic">"{aiMessage}"</p>
                      </div>
                      <a 
                        href={`https://wa.me/${clients.find(c => c.id === selectedOrder.clientId)?.phone.replace(/\D/g,'')}`} 
                        target="_blank"
                        className="w-full bg-red-600 text-white py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-red-100"
                      >
                        <ExternalLink size={18}/> Enviar via WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="border border-slate-100 rounded-3xl overflow-hidden">
                <div className="p-5 bg-slate-50 border-b font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2"><History size={14}/> Histórico</div>
                <div className="p-8 space-y-6">
                  {selectedOrder.history.map((h, i) => (
                    <div key={i} className="flex gap-6 group">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-red-600 shadow-md shadow-red-100 z-10"></div>
                        {i !== selectedOrder.history.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1"></div>}
                      </div>
                      <div className="pb-6">
                        <div className="font-black text-xs mb-1"><StatusBadge status={h.status}/></div>
                        <div className="text-[10px] text-slate-400 font-bold">{new Date(h.date).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SaaSModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Novo Protocolo Técnico">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const newOrder: ServiceOrder = {
            id: `OS-${Math.floor(1000 + Math.random() * 9000)}`,
            clientId: formData.get('clientId') as string,
            printerModel: formData.get('printerModel') as string,
            serialNumber: formData.get('serialNumber') as string,
            problemDescription: formData.get('problemDescription') as string,
            status: OrderStatus.PENDING,
            history: [{ status: OrderStatus.PENDING, date: new Date(), user: 'Técnico Admin' }],
            priority: formData.get('priority') as any,
            createdAt: new Date(),
            updatedAt: new Date(),
            totalCost: 0
          };
          setOrders(prev => [newOrder, ...prev]);
          setIsOrderModalOpen(false);
        }} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente Solicitante</label>
            <select name="clientId" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold transition-all" required>
              <option value="">Selecione um cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {clients.length === 0 && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">Cadastre um cliente antes de abrir OS.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Equipamento</label>
              <input name="printerModel" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Modelo" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridade</label>
              <select name="priority" defaultValue="Normal" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                <option value="Baixa">Baixa</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta 🔥</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Defeito Reportado</label>
            <textarea name="problemDescription" rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold resize-none" placeholder="Relato técnico inicial..." required />
          </div>
          <button type="submit" disabled={clients.length === 0} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest disabled:opacity-50">Registrar Ordem</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Novo Cadastro de Cliente">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setClients(prev => [...prev, {
            id: Date.now().toString(),
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
            email: formData.get('email') as string,
          }]);
          setIsClientModalOpen(false);
        }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome Completo / Fantasia" required />
          <input name="phone" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="WhatsApp (DD) 9XXXX-XXXX" required />
          <input name="email" type="email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="E-mail Administrativo" />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">Salvar Cliente</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Adicionar ao Estoque">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setInventory(prev => [...prev, {
            id: Date.now().toString(),
            name: formData.get('name') as string,
            quantity: parseInt(formData.get('quantity') as string),
            minStock: parseInt(formData.get('minStock') as string),
            costPrice: parseFloat(formData.get('costPrice') as string),
            sellPrice: parseFloat(formData.get('sellPrice') as string),
          }]);
          setIsInventoryModalOpen(false);
        }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça / Suprimento" required />
          <div className="grid grid-cols-2 gap-4">
            <input name="quantity" type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Qtd" required />
            <input name="minStock" type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Estoque Mín." required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input name="costPrice" type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Custo (R$)" required />
            <input name="sellPrice" type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Venda (R$)" required />
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">Cadastrar</button>
        </form>
      </SaaSModal>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; background: white; }
          .print-hidden { display: none !important; }
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
      <div className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl">
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