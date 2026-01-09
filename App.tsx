import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Wrench, 
  Users, 
  Package, 
  Settings, 
  Plus, 
  Search, 
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
  Mail,
  User,
  Trash2,
  ChevronDown,
  Copy,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Client, InventoryItem, ServiceOrder, OrderStatus, StatusHistoryEntry } from './types';
import { getPrinterDiagnosis, generateClientMessage } from './services/geminiService';

// --- MOCK DATA INITIALIZATION ---
const MOCK_CLIENTS: Client[] = [
  { id: '1', name: 'Empresa ABC Ltda', phone: '(11) 99999-1234', email: 'contato@abc.com' },
  { id: '2', name: 'João da Silva', phone: '(11) 98888-5678', email: 'joao@gmail.com' },
  { id: '3', name: 'Papelaria Central', phone: '(11) 97777-4321', email: 'compras@papelaria.com' },
];

const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Fusor HP P1102', quantity: 3, costPrice: 150, sellPrice: 350, minStock: 2 },
  { id: '2', name: 'Pickup Roller Epson L3150', quantity: 15, costPrice: 20, sellPrice: 60, minStock: 5 },
  { id: '3', name: 'Cabeça de Impressão Canon', quantity: 1, costPrice: 400, sellPrice: 800, minStock: 1 },
];

const MOCK_ORDERS: ServiceOrder[] = [
  { 
    id: 'OS-1001', 
    clientId: '1', 
    printerModel: 'HP Laserjet P1102w', 
    serialNumber: 'VNB3B00001', 
    problemDescription: 'Manchas na impressão e barulho forte ao ligar.', 
    status: OrderStatus.DIAGNOSING, 
    history: [
        { status: OrderStatus.PENDING, date: new Date(Date.now() - 86400000 * 2), user: 'Sistema' },
        { status: OrderStatus.DIAGNOSING, date: new Date(Date.now() - 86400000 * 1), user: 'Técnico Admin' }
    ],
    createdAt: new Date(Date.now() - 86400000 * 2), 
    updatedAt: new Date(), 
    totalCost: 0,
    priority: 'Alta'
  }
];

// --- HELPER COMPONENTS ---

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const colors = {
    [OrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
    [OrderStatus.DIAGNOSING]: 'bg-blue-100 text-blue-800',
    [OrderStatus.WAITING_APPROVAL]: 'bg-purple-100 text-purple-800',
    [OrderStatus.IN_REPAIR]: 'bg-indigo-100 text-indigo-800',
    [OrderStatus.READY]: 'bg-green-100 text-green-800',
    [OrderStatus.DELIVERED]: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status]}`}>
      {status}
    </span>
  );
};

// --- MAIN APP ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'clients'>('dashboard');
  const [orders, setOrders] = useState<ServiceOrder[]>(MOCK_ORDERS);
  const [inventory, setInventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);

  // Modal States
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  
  // AI States
  const [aiDiagnosis, setAiDiagnosis] = useState<string>('');
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- DERIVED DATA ---
  const stats = useMemo(() => {
    const revenue = orders
      .filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.READY)
      .reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
    const pending = orders.filter(o => o.status !== OrderStatus.DELIVERED).length;
    const completed = orders.filter(o => o.status === OrderStatus.DELIVERED).length;
    const lowStock = inventory.filter(i => i.quantity <= i.minStock).length;
    return { revenue, pending, completed, lowStock };
  }, [orders, inventory]);

  const ordersByStatusData = useMemo(() => {
    const counts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [orders]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  // --- ACTIONS ---

  const handleCreateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newOrder: ServiceOrder = {
      id: `OS-${Date.now().toString().slice(-4)}`,
      clientId: formData.get('clientId') as string,
      printerModel: formData.get('printerModel') as string,
      serialNumber: formData.get('serialNumber') as string,
      problemDescription: formData.get('problemDescription') as string,
      status: OrderStatus.PENDING,
      history: [{ status: OrderStatus.PENDING, date: new Date(), user: 'Técnico Admin' }],
      priority: formData.get('priority') as 'Baixa' | 'Normal' | 'Alta',
      createdAt: new Date(),
      updatedAt: new Date(),
      totalCost: 0
    };
    setOrders(prev => [newOrder, ...prev]);
    setIsOrderModalOpen(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    const historyEntry: StatusHistoryEntry = { status: newStatus, date: new Date(), user: 'Técnico Admin' };
    
    let updatedOrder: ServiceOrder | undefined;

    setOrders(prev => prev.map(o => {
        if (o.id === id) {
            updatedOrder = { ...o, status: newStatus, updatedAt: new Date(), history: [historyEntry, ...o.history] };
            return updatedOrder;
        }
        return o;
    }));

    if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus, history: [historyEntry, ...prev.history] } : null);
    }

    // AUTO AI NOTIFICATION LOGIC
    if (updatedOrder && (newStatus === OrderStatus.READY || newStatus === OrderStatus.DELIVERED)) {
        setIsAiLoading(true);
        const client = clients.find(c => c.id === updatedOrder?.clientId);
        const msg = await generateClientMessage(
            client?.name || 'Cliente',
            updatedOrder.printerModel,
            newStatus,
            newStatus === OrderStatus.READY ? "Equipamento pronto para retirada." : "Equipamento entregue ao cliente."
        );
        setAiMessage(msg);
        setIsAiLoading(false);
    }
  };

  const handleDeleteOrder = (id: string) => {
    if (window.confirm('Excluir esta Ordem de Serviço permanentemente?')) {
        setOrders(prev => prev.filter(o => o.id !== id));
        if (selectedOrder?.id === id) setSelectedOrder(null);
    }
  };

  const handleDeleteClient = (id: string) => {
    if (window.confirm('Excluir este cliente? Todas as OS vinculadas perderão a referência de nome.')) {
        setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleDeleteInventoryItem = (id: string) => {
    if (window.confirm('Remover esta peça do estoque?')) {
        setInventory(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleCreateClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newClient: Client = {
      id: Date.now().toString(),
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
    };
    setClients(prev => [...prev, newClient]);
    setIsClientModalOpen(false);
  };

  const handleCreateInventoryItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newItem: InventoryItem = {
      id: Date.now().toString(),
      name: formData.get('name') as string,
      quantity: parseInt(formData.get('quantity') as string) || 0,
      costPrice: parseFloat(formData.get('costPrice') as string) || 0,
      sellPrice: parseFloat(formData.get('sellPrice') as string) || 0,
      minStock: parseInt(formData.get('minStock') as string) || 1,
    };
    setInventory(prev => [...prev, newItem]);
    setIsInventoryModalOpen(false);
  };

  // --- RENDERERS ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Faturamento OS" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<Package size={18}/>} color="bg-green-100 text-green-600" />
        <StatCard title="OS Pendentes" value={stats.pending.toString()} icon={<Clock size={18}/>} color="bg-yellow-100 text-yellow-600" />
        <StatCard title="Concluídas" value={stats.completed.toString()} icon={<CheckCircle size={18}/>} color="bg-blue-100 text-blue-600" />
        <StatCard title="Reposição Peças" value={stats.lowStock.toString()} icon={<AlertTriangle size={18}/>} color="bg-red-100 text-red-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
          <h3 className="text-lg font-semibold mb-6">Status Geral</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={ordersByStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {ordersByStatusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80 flex flex-col items-center justify-center text-center">
            <BrainCircuit size={48} className="text-blue-500 mb-4 opacity-50" />
            <p className="text-slate-500 font-medium">IA ativa monitorando processos</p>
            <p className="text-xs text-slate-400 max-w-xs mt-2">Geração automática de orçamentos e mensagens de entrega ativada.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <Printer size={28} className="text-blue-600" />
            <span className="text-xl font-bold text-slate-900 tracking-tight">PrintTech</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavButton icon={<LayoutDashboard size={20}/>} label="Painel" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={<Wrench size={20}/>} label="Ordens de Serviço" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavButton icon={<Package size={20}/>} label="Estoque" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavButton icon={<Users size={20}/>} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && renderDashboard()}
          
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold">Ordens de Serviço</h2>
                <button onClick={() => setIsOrderModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                  <Plus size={18}/> Nova OS
                </button>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="p-4">OS</th>
                    <th className="p-4">Cliente / Máquina</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Prioridade</th>
                    <th className="p-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-blue-600">{o.id}</td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{clients.find(c => c.id === o.clientId)?.name}</div>
                        <div className="text-xs text-slate-500">{o.printerModel}</div>
                      </td>
                      <td className="p-4"><StatusBadge status={o.status}/></td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${o.priority === 'Alta' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                          {o.priority}
                        </span>
                      </td>
                      <td className="p-4 flex items-center gap-2">
                        <button onClick={() => setSelectedOrder(o)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><ChevronRight size={20}/></button>
                        <button onClick={() => handleDeleteOrder(o.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold">Estoque de Peças</h2>
                <button onClick={() => setIsInventoryModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <Plus size={18}/> Novo Item
                </button>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="p-4">Item</th>
                    <th className="p-4">Quantidade</th>
                    <th className="p-4">Venda (Un)</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventory.map(i => (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="p-4 font-medium">{i.name}</td>
                      <td className="p-4">{i.quantity}</td>
                      <td className="p-4">R$ {i.sellPrice.toFixed(2)}</td>
                      <td className="p-4">
                        {i.quantity <= i.minStock ? <span className="text-red-500 text-xs font-bold">REPOR</span> : <span className="text-green-500 text-xs font-bold">OK</span>}
                      </td>
                      <td className="p-4">
                        <button onClick={() => handleDeleteInventoryItem(i.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">Gestão de Clientes</h2>
                    <button onClick={() => setIsClientModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Plus size={18}/> Novo Cliente
                    </button>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <tr>
                            <th className="p-4">Nome</th>
                            <th className="p-4">Contato</th>
                            <th className="p-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {clients.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50">
                                <td className="p-4">
                                    <div className="font-bold text-slate-800">{c.name}</div>
                                    <div className="text-xs text-slate-400">{c.email}</div>
                                </td>
                                <td className="p-4 flex flex-col text-sm text-slate-600">
                                    <span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span>
                                </td>
                                <td className="p-4">
                                    <button onClick={() => handleDeleteClient(c.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}
        </div>
      </main>

      {/* MODALS (Simplified for clarity) */}
      {isOrderModalOpen && <OrderModal clients={clients} onClose={() => setIsOrderModalOpen(false)} onSave={handleCreateOrder} />}
      {isClientModalOpen && <ClientModal onClose={() => setIsClientModalOpen(false)} onSave={handleCreateClient} />}
      {isInventoryModalOpen && <InventoryModal onClose={() => setIsInventoryModalOpen(false)} onSave={handleCreateInventoryItem} />}
      
      {/* OS DETAILS PANEL (WITH AUTO-AI MESSAGE) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto p-8 animate-slide-in-right">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{selectedOrder.id}</h2>
                        <p className="text-slate-500">{clients.find(c => c.id === selectedOrder.clientId)?.name} - {selectedOrder.printerModel}</p>
                    </div>
                    <button onClick={() => {setSelectedOrder(null); setAiMessage('');}} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Alterar Status</p>
                        <div className="flex flex-wrap gap-2">
                            {Object.values(OrderStatus).map(s => (
                                <button 
                                    key={s} 
                                    onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedOrder.status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-sm">
                            <BrainCircuit size={16}/> Smart Assistant
                        </div>
                        <button 
                            disabled={isAiLoading}
                            onClick={async () => {
                                setIsAiLoading(true);
                                const diag = await getPrinterDiagnosis(selectedOrder.printerModel, selectedOrder.problemDescription);
                                setAiDiagnosis(diag);
                                setIsAiLoading(false);
                            }}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isAiLoading ? 'Analisando...' : 'Gerar Diagnóstico Técnico'}
                        </button>
                    </div>
                </div>

                {/* AI MESSAGE SECTION (AUTO-TRIGGERED ON READY/DELIVERED) */}
                {(aiMessage || isAiLoading) && (
                    <div className="mb-8 p-6 bg-green-50 border border-green-100 rounded-2xl animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-green-700 font-bold">
                                <MessageCircle size={20}/> Mensagem para WhatsApp
                            </div>
                            <button 
                                onClick={() => {navigator.clipboard.writeText(aiMessage); alert('Copiado!');}}
                                className="flex items-center gap-1 text-xs bg-white text-green-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md border border-green-200"
                            >
                                <Copy size={14}/> Copiar
                            </button>
                        </div>
                        {isAiLoading ? (
                            <div className="h-20 flex items-center justify-center">
                                <div className="animate-pulse text-green-600 text-sm font-medium">IA redigindo mensagem profissional...</div>
                            </div>
                        ) : (
                            <p className="text-sm text-green-800 whitespace-pre-wrap italic">"{aiMessage}"</p>
                        )}
                        <div className="mt-4 flex gap-2">
                             <a 
                                href={`https://wa.me/${clients.find(c => c.id === selectedOrder.clientId)?.phone.replace(/\D/g,'')}`} 
                                target="_blank"
                                className="flex-1 bg-green-600 text-white text-center py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700"
                             >
                                <ExternalLink size={16}/> Enviar via WhatsApp
                             </a>
                        </div>
                    </div>
                )}

                {aiDiagnosis && (
                    <div className="mb-8 bg-slate-900 text-slate-100 p-6 rounded-2xl">
                        <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold">
                            <BrainCircuit size={18}/> Diagnóstico Técnico (IA)
                        </div>
                        <div className="text-sm prose prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-xs opacity-90">{aiDiagnosis}</pre>
                        </div>
                    </div>
                )}

                <div className="border border-slate-100 rounded-xl">
                    <div className="p-4 bg-slate-50 border-b font-bold text-sm flex items-center gap-2">
                        <History size={16}/> Histórico da Máquina
                    </div>
                    <div className="p-4 space-y-4">
                        {selectedOrder.history.map((h, i) => (
                            <div key={i} className="flex gap-3 text-sm">
                                <div className="w-1 h-12 bg-slate-200 rounded-full shrink-0"/>
                                <div>
                                    <div className="font-bold text-slate-700"><StatusBadge status={h.status}/></div>
                                    <div className="text-xs text-slate-400">{h.date.toLocaleString()} - {h.user}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StatCard({title, value, icon, color}: any) {
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500 text-sm font-medium">{title}</span>
                <span className={`p-2 rounded-lg ${color}`}>{icon}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    );
}

function NavButton({icon, label, active, onClick}: any) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
        >
            {icon} {label}
        </button>
    );
}

function OrderModal({clients, onClose, onSave}: any) {
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-bold">Nova Ordem de Serviço</h3>
                    <button onClick={onClose}><X/></button>
                </div>
                <form onSubmit={onSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Cliente</label>
                        <select name="clientId" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required>
                            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Modelo Impressora</label>
                            <input name="printerModel" type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ex: Epson L3250" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Número de Série</label>
                            <input name="serialNumber" type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Opcional" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Defeito Relatado</label>
                        <textarea name="problemDescription" rows={3} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Descreva o que está acontecendo..." required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Prioridade</label>
                        <select name="priority" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <option value="Normal">Normal</option>
                            <option value="Alta">Alta</option>
                            <option value="Baixa">Baixa</option>
                        </select>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                        <button type="submit" className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700">Abrir Ordem de Serviço</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ClientModal({onClose, onSave}: any) {
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-800">Novo Cliente</h3>
                    <button onClick={onClose}><X/></button>
                </div>
                <form onSubmit={onSave} className="p-6 space-y-4">
                    <input name="name" type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Nome / Razão Social" required />
                    <input name="phone" type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="WhatsApp (DDD) 9..." required />
                    <input name="email" type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Email (Opcional)" />
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 mt-2">Salvar Cliente</button>
                </form>
            </div>
        </div>
    );
}

function InventoryModal({onClose, onSave}: any) {
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-800">Adicionar Peça</h3>
                    <button onClick={onClose}><X/></button>
                </div>
                <form onSubmit={onSave} className="p-6 space-y-4">
                    <input name="name" type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Nome da Peça" required />
                    <div className="grid grid-cols-2 gap-4">
                        <input name="quantity" type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Qtd. Inicial" required />
                        <input name="minStock" type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Estoque Mín." required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input name="costPrice" type="number" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Preço Custo" required />
                        <input name="sellPrice" type="number" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Preço Venda" required />
                    </div>
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 mt-2">Cadastrar no Estoque</button>
                </form>
            </div>
        </div>
    );
}