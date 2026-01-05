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
  ChevronDown
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
  { id: '4', name: 'Tinta Black Universal 1L', quantity: 8, costPrice: 45, sellPrice: 120, minStock: 10 },
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
  },
  { 
    id: 'OS-1002', 
    clientId: '2', 
    printerModel: 'Epson L3150', 
    serialNumber: 'X5T9999', 
    problemDescription: 'Não puxa papel.', 
    status: OrderStatus.WAITING_APPROVAL, 
    history: [
        { status: OrderStatus.PENDING, date: new Date(Date.now() - 86400000 * 5), user: 'Sistema' },
        { status: OrderStatus.DIAGNOSING, date: new Date(Date.now() - 86400000 * 4), user: 'Técnico Admin' },
        { status: OrderStatus.WAITING_APPROVAL, date: new Date(Date.now() - 86400000 * 3), user: 'Técnico Admin' }
    ],
    createdAt: new Date(Date.now() - 86400000 * 5), 
    updatedAt: new Date(), 
    totalCost: 180,
    priority: 'Normal'
  },
  { 
    id: 'OS-1003', 
    clientId: '3', 
    printerModel: 'Brother DCP-1617', 
    serialNumber: 'E78222', 
    problemDescription: 'Atolamento de papel constante.', 
    status: OrderStatus.READY, 
    history: [
        { status: OrderStatus.PENDING, date: new Date(Date.now() - 86400000 * 2), user: 'Sistema' },
        { status: OrderStatus.READY, date: new Date(), user: 'Técnico Admin' }
    ],
    createdAt: new Date(Date.now() - 86400000 * 1), 
    updatedAt: new Date(), 
    totalCost: 250,
    priority: 'Alta'
  },
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

  // --- DERIVED DATA FOR DASHBOARD ---
  const stats = useMemo(() => {
    const revenue = orders
      .filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.READY)
      .reduce((acc, curr) => acc + curr.totalCost, 0);
    
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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // --- ACTIONS ---

  const handleCreateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newOrder: ServiceOrder = {
      id: `OS-${1000 + orders.length + 1}`,
      clientId: formData.get('clientId') as string,
      printerModel: formData.get('printerModel') as string,
      serialNumber: formData.get('serialNumber') as string,
      problemDescription: formData.get('problemDescription') as string,
      status: OrderStatus.PENDING,
      history: [
        { status: OrderStatus.PENDING, date: new Date(), user: 'Técnico Admin' }
      ],
      priority: formData.get('priority') as 'Baixa' | 'Normal' | 'Alta',
      createdAt: new Date(),
      updatedAt: new Date(),
      totalCost: 0
    };
    setOrders([newOrder, ...orders]);
    setIsOrderModalOpen(false);
  };

  const handleCreateClient = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const newClient: Client = {
          id: (clients.length + 1).toString(),
          name: formData.get('name') as string,
          phone: formData.get('phone') as string,
          email: formData.get('email') as string,
      };
      setClients([...clients, newClient]);
      setIsClientModalOpen(false);
  };

  const handleDeleteClient = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente? Isso pode afetar OS vinculadas.')) {
        setClients(clients.filter(c => c.id !== id));
    }
  };

  const handleCreateInventoryItem = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const newItem: InventoryItem = {
          id: (inventory.length + 1).toString(),
          name: formData.get('name') as string,
          quantity: parseInt(formData.get('quantity') as string),
          costPrice: parseFloat(formData.get('costPrice') as string),
          sellPrice: parseFloat(formData.get('sellPrice') as string),
          minStock: parseInt(formData.get('minStock') as string),
      };
      setInventory([...inventory, newItem]);
      setIsInventoryModalOpen(false);
  };

  const handleDeleteInventoryItem = (id: string) => {
      if (window.confirm('Tem certeza que deseja remover este item do estoque?')) {
          setInventory(inventory.filter(item => item.id !== id));
      }
  };

  const handleDeleteOrder = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta Ordem de Serviço?')) {
        setOrders(orders.filter(o => o.id !== id));
        if (selectedOrder && selectedOrder.id === id) {
            setSelectedOrder(null);
        }
    }
  };

  const handleUpdateStatus = (id: string, newStatus: OrderStatus) => {
    const historyEntry: StatusHistoryEntry = {
        status: newStatus,
        date: new Date(),
        user: 'Técnico Admin'
    };

    setOrders(orders.map(o => {
        if (o.id === id) {
            return { 
                ...o, 
                status: newStatus, 
                updatedAt: new Date(),
                history: [historyEntry, ...o.history]
            };
        }
        return o;
    }));

    if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(prev => prev ? {
            ...prev,
            status: newStatus,
            history: [historyEntry, ...prev.history]
        } : null);
    }
  };

  const handleAiDiagnosis = async () => {
    if (!selectedOrder) return;
    setIsAiLoading(true);
    setAiDiagnosis('');
    const result = await getPrinterDiagnosis(selectedOrder.printerModel, selectedOrder.problemDescription);
    setAiDiagnosis(result);
    setIsAiLoading(false);
  };

  const handleAiMessage = async () => {
    if (!selectedOrder) return;
    setIsAiLoading(true);
    setAiMessage('');
    const client = clients.find(c => c.id === selectedOrder.clientId);
    const result = await generateClientMessage(
      client?.name || 'Cliente',
      selectedOrder.printerModel,
      selectedOrder.status,
      selectedOrder.diagnosis || "Orçamento pendente"
    );
    setAiMessage(result);
    setIsAiLoading(false);
  };

  // --- VIEW RENDERERS ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 text-sm font-medium">Receita Estimada</h3>
            <span className="p-2 bg-green-100 text-green-600 rounded-lg"><Package size={18} /></span>
          </div>
          <p className="text-2xl font-bold text-slate-800">R$ {stats.revenue.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-1">+12% vs mês anterior</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 text-sm font-medium">OS Pendentes</h3>
            <span className="p-2 bg-yellow-100 text-yellow-600 rounded-lg"><Clock size={18} /></span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
          <p className="text-xs text-yellow-600 mt-1">Requerem atenção</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 text-sm font-medium">OS Concluídas</h3>
            <span className="p-2 bg-blue-100 text-blue-600 rounded-lg"><CheckCircle size={18} /></span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.completed}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 text-sm font-medium">Alerta Estoque</h3>
            <span className="p-2 bg-red-100 text-red-600 rounded-lg"><AlertTriangle size={18} /></span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.lowStock}</p>
          <p className="text-xs text-red-600 mt-1">Itens abaixo do mínimo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Status das Ordens</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ordersByStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {ordersByStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Desempenho Semanal</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'Seg', orders: 4 },
                { name: 'Ter', orders: 3 },
                { name: 'Qua', orders: 7 },
                { name: 'Qui', orders: 5 },
                { name: 'Sex', orders: 6 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Ordens de Serviço</h2>
        <button 
          onClick={() => { setSelectedOrder(null); setIsOrderModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Nova OS
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-sm text-left">
            <tr>
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Cliente</th>
              <th className="p-4 font-medium">Equipamento</th>
              <th className="p-4 font-medium">Prioridade</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(order => {
              const client = clients.find(c => c.id === order.clientId);
              return (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-700">{order.id}</td>
                  <td className="p-4 text-slate-600">{client?.name}</td>
                  <td className="p-4 text-slate-600">{order.printerModel}</td>
                  <td className="p-4">
                     <span className={`text-xs px-2 py-1 rounded-full border ${order.priority === 'Alta' ? 'border-red-200 text-red-700 bg-red-50' : 'border-slate-200 text-slate-600'}`}>
                        {order.priority}
                     </span>
                  </td>
                  <td className="p-4"><StatusBadge status={order.status} /></td>
                  <td className="p-4 text-slate-500 text-sm">{order.createdAt.toLocaleDateString()}</td>
                  <td className="p-4 flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                      title="Ver Detalhes"
                    >
                      <ChevronRight size={20} />
                    </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Excluir OS"
                    >
                        <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Estoque de Peças</h2>
        <button 
            onClick={() => setIsInventoryModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> Adicionar Item
        </button>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50 text-slate-500 text-sm text-left">
          <tr>
            <th className="p-4 font-medium">Item</th>
            <th className="p-4 font-medium">Qtd</th>
            <th className="p-4 font-medium">Custo</th>
            <th className="p-4 font-medium">Venda</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {inventory.map(item => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="p-4 font-medium text-slate-700">{item.name}</td>
              <td className="p-4 text-slate-600">{item.quantity}</td>
              <td className="p-4 text-slate-600">R$ {item.costPrice.toFixed(2)}</td>
              <td className="p-4 text-slate-600">R$ {item.sellPrice.toFixed(2)}</td>
              <td className="p-4">
                {item.quantity <= item.minStock ? (
                  <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <AlertTriangle size={14} /> Baixo Estoque
                  </span>
                ) : (
                  <span className="text-green-600 text-sm font-medium">OK</span>
                )}
              </td>
              <td className="p-4">
                 <button 
                    onClick={() => handleDeleteInventoryItem(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir Item"
                 >
                    <Trash2 size={18} />
                 </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderClients = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Clientes</h2>
            <button 
                onClick={() => setIsClientModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
                <Plus size={18} /> Novo Cliente
            </button>
        </div>
        <table className="w-full">
            <thead className="bg-slate-50 text-slate-500 text-sm text-left">
                <tr>
                    <th className="p-4 font-medium">Nome</th>
                    <th className="p-4 font-medium">Telefone</th>
                    <th className="p-4 font-medium">E-mail</th>
                    <th className="p-4 font-medium">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {clients.map(client => (
                    <tr key={client.id} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-700 flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                                {client.name.substring(0, 2).toUpperCase()}
                             </div>
                            {client.name}
                        </td>
                        <td className="p-4 text-slate-600"><div className="flex items-center gap-2"><Phone size={14} />{client.phone}</div></td>
                        <td className="p-4 text-slate-600"><div className="flex items-center gap-2"><Mail size={14} />{client.email}</div></td>
                        <td className="p-4">
                            <button 
                                onClick={() => handleDeleteClient(client.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Excluir Cliente"
                            >
                                <Trash2 size={18} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-blue-600">
            <Printer size={28} />
            <span className="text-xl font-bold tracking-tight text-slate-900">PrintTech</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Gestão de Assistência</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Wrench size={20} /> Ordens de Serviço
          </button>
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Package size={20} /> Estoque
          </button>
          <button 
            onClick={() => setActiveTab('clients')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'clients' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Users size={20} /> Clientes
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">T</div>
              <div>
                <p className="text-sm font-medium text-slate-800">Técnico Admin</p>
                <p className="text-xs text-slate-500">Logado</p>
              </div>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-8 md:hidden">
            <span className="font-bold text-lg">PrintTech Manager</span>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
           {activeTab === 'dashboard' && renderDashboard()}
           {activeTab === 'orders' && renderOrders()}
           {activeTab === 'inventory' && renderInventory()}
           {activeTab === 'clients' && renderClients()}
        </div>
      </main>

      {/* CREATE ORDER MODAL */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Nova Ordem de Serviço</h3>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select name="clientId" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modelo Impressora</label>
                  <input name="printerModel" type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Ex: HP P1102" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nº Série</label>
                  <input name="serialNumber" type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Opcional" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Defeito Relatado</label>
                <textarea name="problemDescription" rows={3} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Descreva o problema..."></textarea>
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                 <select name="priority" className="w-full p-2 border border-slate-300 rounded-lg">
                    <option value="Baixa">Baixa</option>
                    <option value="Normal" selected>Normal</option>
                    <option value="Alta">Alta</option>
                 </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOrderModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Criar OS</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CLIENT MODAL */}
      {isClientModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">Novo Cliente</h3>
                      <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                  </div>
                  <form onSubmit={handleCreateClient} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo / Razão Social</label>
                          <input name="name" type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Ex: João da Silva" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                              <input name="phone" type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="(11) 99999-9999" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                              <input name="email" type="email" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="joao@email.com" />
                          </div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Cadastrar Cliente</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* CREATE INVENTORY ITEM MODAL */}
      {isInventoryModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">Novo Item de Estoque</h3>
                      <button onClick={() => setIsInventoryModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                  </div>
                  <form onSubmit={handleCreateInventoryItem} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Item / Peça</label>
                          <input name="name" type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Ex: Toner HP 85A" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Atual</label>
                              <input name="quantity" type="number" min="0" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mínimo</label>
                              <input name="minStock" type="number" min="0" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Preço Custo (R$)</label>
                              <input name="costPrice" type="number" step="0.01" min="0" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Preço Venda (R$)</label>
                              <input name="sellPrice" type="number" step="0.01" min="0" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                          </div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsInventoryModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Salvar Item</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* ORDER DETAILS / AI MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh] shadow-2xl overflow-y-auto flex flex-col md:flex-row">
            
            {/* LEFT: Order Info */}
            <div className="flex-1 p-6 md:border-r border-slate-100">
               <div className="flex justify-between items-start mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedOrder.id}</h2>
                    <p className="text-slate-500">{clients.find(c => c.id === selectedOrder.clientId)?.name}</p>
                 </div>
                 <button onClick={() => { setSelectedOrder(null); setAiDiagnosis(''); setAiMessage(''); }} className="md:hidden p-2 bg-slate-100 rounded-full"><X size={20}/></button>
               </div>

               <div className="space-y-6">
                 <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Equipamento</p>
                    <p className="font-medium text-slate-800 text-lg">{selectedOrder.printerModel}</p>
                    <p className="text-sm text-slate-500">NS: {selectedOrder.serialNumber}</p>
                 </div>

                 <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descrição do Problema</p>
                    <p className="text-slate-700 bg-red-50 p-3 rounded-lg border border-red-100">{selectedOrder.problemDescription}</p>
                 </div>

                 {/* Collapsible Status History */}
                 <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <details className="group">
                        <summary className="flex items-center justify-between p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <History size={16} /> Histórico de Status
                            </span>
                            <span className="transition-transform group-open:rotate-180">
                                <ChevronDown size={16} className="text-slate-500"/>
                            </span>
                        </summary>
                        <div className="p-4 bg-white border-t border-slate-100 max-h-40 overflow-y-auto">
                            <ul className="space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                {selectedOrder.history && selectedOrder.history.length > 0 ? (
                                    selectedOrder.history.map((entry, idx) => (
                                        <li key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center w-full">
                                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow shrink-0 absolute left-0 md:static md:mx-0 z-10"></div>
                                                <div className="ml-6 flex flex-col w-full">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-semibold text-slate-800"><StatusBadge status={entry.status} /></span>
                                                        <span className="text-[10px] text-slate-400">{entry.date.toLocaleString()}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 mt-1 flex items-center gap-1"><User size={10} /> {entry.user}</span>
                                                </div>
                                            </div>
                                        </li>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 italic text-center">Nenhum histórico registrado.</p>
                                )}
                            </ul>
                        </div>
                    </details>
                 </div>

                 <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Alterar Status</p>
                    <div className="flex flex-wrap gap-2">
                        {Object.values(OrderStatus).map(status => (
                            <button 
                                key={status}
                                onClick={() => handleUpdateStatus(selectedOrder.id, status as OrderStatus)}
                                className={`px-3 py-1 rounded-full text-xs border transition-all ${selectedOrder.status === status ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                 </div>
               </div>
            </div>

            {/* RIGHT: AI Tools & Actions */}
            <div className="w-full md:w-96 bg-slate-50 p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center md:mb-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><BrainCircuit size={20} className="text-purple-600"/> Smart Assistant</h3>
                    <button onClick={() => { setSelectedOrder(null); setAiDiagnosis(''); setAiMessage(''); }} className="hidden md:block text-slate-400 hover:text-slate-600"><X size={24}/></button>
                </div>

                {/* AI DIAGNOSIS CARD */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Diagnóstico IA</h4>
                    <p className="text-xs text-slate-500 mb-3">Obtenha sugestões de reparo baseadas no modelo e problema.</p>
                    
                    {!aiDiagnosis ? (
                        <button 
                            onClick={handleAiDiagnosis}
                            disabled={isAiLoading}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                           {isAiLoading ? 'Analisando...' : 'Diagnosticar Agora'}
                        </button>
                    ) : (
                        <div className="mt-2 animate-fade-in">
                            <div className="max-h-48 overflow-y-auto text-sm text-slate-700 prose prose-sm">
                                <pre className="whitespace-pre-wrap font-sans text-xs">{aiDiagnosis}</pre>
                            </div>
                            <button onClick={() => setAiDiagnosis('')} className="mt-2 text-xs text-slate-400 underline w-full text-center">Limpar</button>
                        </div>
                    )}
                </div>

                {/* AI MESSAGE CARD */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col">
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Mensagem ao Cliente</h4>
                    <p className="text-xs text-slate-500 mb-3">Gere atualizações profissionais para WhatsApp.</p>
                    
                    {!aiMessage ? (
                         <button 
                            onClick={handleAiMessage}
                            disabled={isAiLoading}
                            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-auto"
                        >
                            <MessageCircle size={16} />
                           {isAiLoading ? 'Escrevendo...' : 'Gerar Mensagem'}
                        </button>
                    ) : (
                        <div className="mt-2 animate-fade-in flex-1 flex flex-col">
                            <textarea 
                                readOnly 
                                className="w-full flex-1 p-2 bg-green-50 text-green-900 rounded-lg text-sm border border-green-100 resize-none focus:outline-none mb-2"
                                value={aiMessage}
                            />
                             <div className="flex gap-2">
                                <button onClick={() => {navigator.clipboard.writeText(aiMessage); alert('Copiado!');}} className="flex-1 py-1 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300 font-medium">Copiar</button>
                                <button onClick={() => setAiMessage('')} className="flex-1 py-1 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50">Voltar</button>
                             </div>
                        </div>
                    )}
                </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}