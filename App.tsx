import React, { useState, useMemo } from 'react';
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
  TrendingUp
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

// Mock inicial
const INITIAL_CLIENTS: Client[] = [
  { id: '1', name: 'Empresa ABC Ltda', phone: '(11) 99999-1234', email: 'contato@abc.com' },
  { id: '2', name: 'João da Silva', phone: '(11) 98888-5678', email: 'joao@gmail.com' },
];

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Fusor HP P1102', quantity: 1, costPrice: 150, sellPrice: 350, minStock: 2 },
  { id: '2', name: 'Pickup Roller Epson L3150', quantity: 15, costPrice: 20, sellPrice: 60, minStock: 5 },
  { id: '3', name: 'Tinta Black 1L', quantity: 8, costPrice: 45, sellPrice: 120, minStock: 10 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'clients'>('dashboard');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  
  const [aiDiagnosis, setAiDiagnosis] = useState<string>('');
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

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

  const weeklyData = [
    { name: 'Seg', total: 4 },
    { name: 'Ter', total: 7 },
    { name: 'Qua', total: 5 },
    { name: 'Qui', total: 8 },
    { name: 'Sex', total: 12 },
  ];

  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#64748b'];

  // Ações
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

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg shadow-md shadow-red-200">
            <Printer size={24} className="text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900">PRINT<span className="text-red-600">TECH</span></span>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavButton icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={<Wrench size={20}/>} label="Ordens de Serviço" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavButton icon={<Package size={20}/>} label="Estoque" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavButton icon={<Users size={20}/>} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
        </nav>
        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
             <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold">AD</div>
             <div className="overflow-hidden">
               <p className="text-xs font-bold truncate">Admin Assistência</p>
               <p className="text-[10px] text-slate-400">Plano Pro</p>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
          
          {/* Header Section */}
          <div className="flex justify-between items-end mb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight capitalize">{activeTab === 'dashboard' ? 'Visão Geral' : activeTab}</h1>
              <p className="text-slate-500 text-sm mt-1">Gerencie sua assistência técnica com inteligência.</p>
            </div>
            {activeTab !== 'dashboard' && (
              <button 
                onClick={() => activeTab === 'orders' ? setIsOrderModalOpen(true) : activeTab === 'clients' ? setIsClientModalOpen(true) : setIsInventoryModalOpen(true)}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl shadow-red-100 flex items-center gap-2 transition-all active:scale-95"
              >
                <Plus size={20}/> Novo Registro
              </button>
            )}
          </div>

          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardStat label="Receita Estimada" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<TrendingUp className="text-green-600"/>} trend="+12.5%" />
                <DashboardStat label="OS em Aberto" value={stats.pending.toString()} icon={<Clock className="text-amber-600"/>} trend="Pendentes" />
                <DashboardStat label="Atenção Estoque" value={stats.lowStock.toString()} icon={<AlertTriangle className="text-red-600"/>} trend="Abaixo do mín." critical={stats.lowStock > 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico de Status */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><BarChart3 size={18} className="text-red-600"/> Distribuição de Status</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atualizado agora</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                          {chartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} cornerRadius={4} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico de Desempenho Semanal */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><TrendingUp size={18} className="text-red-600"/> Ordens por Dia</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Últimos 5 dias</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="total" fill="#dc2626" radius={[6, 6, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="p-6">Nome da Peça / Item</th>
                      <th className="p-6">Qtd Atual</th>
                      <th className="p-6">Custo de Compra</th>
                      <th className="p-6">Preço de Venda</th>
                      <th className="p-6">Mínimo</th>
                      <th className="p-6 text-center">Status</th>
                      <th className="p-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory.map(i => {
                      const isLow = i.quantity <= i.minStock;
                      return (
                        <tr key={i.id} className={`hover:bg-slate-50 transition-colors ${isLow ? 'bg-red-50/30' : ''}`}>
                          <td className="p-6">
                            <div className="font-bold text-slate-900">{i.name}</div>
                            <div className="text-[10px] text-slate-400">REF: {i.id.slice(-6)}</div>
                          </td>
                          <td className="p-6">
                            <span className={`font-black text-lg ${isLow ? 'text-red-600' : 'text-slate-700'}`}>{i.quantity}</span>
                          </td>
                          <td className="p-6 text-sm text-slate-500">R$ {i.costPrice.toFixed(2)}</td>
                          <td className="p-6 text-sm font-bold text-slate-900">R$ {i.sellPrice.toFixed(2)}</td>
                          <td className="p-6 text-sm text-slate-400 font-medium">{i.minStock} un</td>
                          <td className="p-6 text-center">
                            {isLow ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase animate-pulse">
                                <AlertTriangle size={12}/> Estoque Baixo
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase">
                                <CheckCircle size={12}/> Normal
                              </div>
                            )}
                          </td>
                          <td className="p-6 text-right">
                            <button onClick={(e) => handleDeleteInventoryItem(i.id, e)} className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                              <Trash2 size={20}/>
                            </button>
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
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="p-6">Protocolo / Máquina</th>
                    <th className="p-6">Cliente Responsável</th>
                    <th className="p-6">Status Operacional</th>
                    <th className="p-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-medium italic">Nenhuma ordem de serviço registrada no momento.</td></tr>}
                  {orders.map(o => (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-red-50/20 cursor-pointer transition-colors group">
                      <td className="p-6">
                        <div className="font-black text-red-600 text-lg">#{o.id}</div>
                        <div className="text-sm font-medium text-slate-500">{o.printerModel}</div>
                      </td>
                      <td className="p-6">
                        <div className="font-bold text-slate-900">{clients.find(c => c.id === o.clientId)?.name || 'Desconhecido'}</div>
                        <div className="text-xs text-slate-400">Criada em {new Date(o.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="p-6"><StatusBadge status={o.status}/></td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-3 items-center">
                          <button onClick={(e) => handleDeleteOrder(o.id, e)} className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={20}/>
                          </button>
                          <div className="p-2 bg-slate-50 text-slate-400 group-hover:bg-red-600 group-hover:text-white rounded-xl transition-all">
                            <ChevronRight size={20} />
                          </div>
                        </div>
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
                  <tr>
                    <th className="p-6">Nome Completo</th>
                    <th className="p-6">WhatsApp de Contato</th>
                    <th className="p-6 text-right">Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6">
                        <div className="font-black text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-400 lowercase">{c.email || 'Email não informado'}</div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2 font-bold text-slate-600">
                          <MessageCircle size={14} className="text-green-500"/> {c.phone}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <button onClick={(e) => handleDeleteClient(c.id, e)} className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 size={20}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* OS Details Panel (Drawer Style) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-end">
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
              {/* Status Update Section */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Fluxo de Trabalho</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map(s => (
                    <button 
                      key={s} 
                      onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black border transition-all ${selectedOrder.status === s ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100 scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 active:scale-95'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Auto Notification Section */}
              {(aiMessage || isAiLoading) && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl animate-fade-in shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <MessageCircle size={80} className="text-red-600" />
                  </div>
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2 text-red-700 font-black text-sm uppercase tracking-wider"><BrainCircuit size={18}/> Notificação Automática IA</div>
                    <button onClick={() => { navigator.clipboard.writeText(aiMessage); alert('Copiado para área de transferência!'); }} className="text-[10px] font-black bg-white text-red-700 px-3 py-2 rounded-xl border border-red-200 hover:shadow-md flex items-center gap-1.5 transition-all"><Copy size={12}/> Copiar Texto</button>
                  </div>
                  {isAiLoading ? (
                    <div className="flex items-center gap-3 text-red-600 text-xs py-4 font-bold uppercase tracking-widest"><div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div> Processando mensagem profissional...</div>
                  ) : (
                    <div className="relative z-10">
                      <div className="bg-white/60 p-4 rounded-2xl mb-4 border border-red-100 shadow-inner">
                        <p className="text-sm text-red-900 italic leading-relaxed whitespace-pre-wrap font-medium">"{aiMessage}"</p>
                      </div>
                      <a 
                        href={`https://wa.me/${clients.find(c => c.id === selectedOrder.clientId)?.phone.replace(/\D/g,'')}`} 
                        target="_blank"
                        className="w-full bg-red-600 text-white py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-xl shadow-red-100"
                      >
                        <ExternalLink size={18}/> Enviar via WhatsApp Business
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* History Timeline */}
              <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-5 bg-slate-50 border-b font-black text-[10px] uppercase tracking-widest flex items-center gap-2 text-slate-500"><History size={14}/> Linha do Tempo da Ordem</div>
                <div className="p-8 space-y-6">
                  {selectedOrder.history.map((h, i) => (
                    <div key={i} className="flex gap-6 group">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-red-600 shadow-md shadow-red-100 z-10"></div>
                        {i !== selectedOrder.history.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1"></div>}
                      </div>
                      <div className="pb-6">
                        <div className="font-black text-xs mb-1"><StatusBadge status={h.status}/></div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{new Date(h.date).toLocaleString()} • Responsável: {h.user}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SaaS Styled Modals */}
      <SaaSModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Abertura de Protocolo">
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
            <select name="clientId" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-red-100 focus:border-red-600 outline-none font-bold transition-all" required>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Equipamento</label>
              <input name="printerModel" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Modelo" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nível de Prioridade</label>
              <select name="priority" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                <option value="Normal">Normal</option>
                <option value="Alta">Alta 🔥</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Técnica do Defeito</label>
            <textarea name="problemDescription" rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold resize-none" placeholder="Relato do problema..." required />
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 uppercase tracking-widest">Registrar Ordem de Serviço</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Cadastro de Cliente">
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
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome Completo / Empresa" required />
          <input name="phone" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="WhatsApp" required />
          <input name="email" type="email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="E-mail (Opcional)" />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">Salvar Cliente</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Nova Peça em Estoque">
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
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome do Item" required />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
               <input name="quantity" type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Qtd" required />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estoque Mín.</label>
               <input name="minStock" type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Mín." required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Custo</label>
               <input name="costPrice" type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="R$" required />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Venda</label>
               <input name="sellPrice" type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="R$" required />
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-widest">Adicionar ao Estoque</button>
        </form>
      </SaaSModal>
    </div>
  );
}

// Sub-componentes Refinados

function NavButton({icon, label, active, onClick}: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-red-600 text-white font-black shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-red-50 hover:text-red-600 font-bold'}`}
    >
      <span className={active ? 'text-white' : ''}>{icon}</span>
      <span className="text-sm tracking-tight">{label}</span>
    </button>
  );
}

function DashboardStat({label, value, icon, trend, critical}: any) {
  return (
    <div className={`bg-white p-7 rounded-[32px] border border-slate-200 shadow-sm transition-all hover:-translate-y-1 group ${critical ? 'border-red-200 bg-red-50/20' : ''}`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl transition-colors ${critical ? 'bg-red-100' : 'bg-slate-50 group-hover:bg-red-600/10'}`}>
          {icon}
        </div>
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
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-all text-slate-400"><X size={20}/></button>
        </div>
        <div className="p-10">
          {children}
        </div>
      </div>
    </div>
  );
}