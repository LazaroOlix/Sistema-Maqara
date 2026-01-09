
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
  FileText,
  MinusCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Client, InventoryItem, ServiceOrder, OrderStatus, PartReminder, PartReminderStatus, Machine } from './types';
import { generateClientMessage } from './services/geminiService';

const LOGO_IMAGE = '/logo.png';

// Fix: Defined the missing COLORS constant for PieChart colors
const COLORS = ['#dc2626', '#0f172a', '#f59e0b', '#10b981', '#3b82f6', '#6366f1'];

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
  const [selectedMachineId, setSelectedMachineId] = useState('');

  // Estados para máquinas no modal de cliente
  const [clientMachinesDraft, setClientMachinesDraft] = useState<Machine[]>([]);

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

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(appData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `maqara_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

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

  const handlePrintInventory = async () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    const totalInvestment = inventory.reduce((acc, i) => acc + (i.quantity * i.costPrice), 0);
    const totalItems = inventory.reduce((acc, i) => acc + i.quantity, 0);

    printArea.style.display = 'block';
    printArea.style.position = 'fixed';
    printArea.style.left = '-5000px';
    printArea.style.top = '0';
    printArea.style.width = '210mm';

    printArea.innerHTML = `
      <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #0f172a; background: white; width: 210mm; min-height: 297mm; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 24px; margin-bottom: 32px;">
          <div>
            <h1 style="font-size: 32px; font-weight: 900; color: #dc2626; margin: 0; letter-spacing: -1px;">MAQARA</h1>
            <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px;">Relatório de Estoque Profissional</p>
          </div>
          <div style="text-align: right;">
            <h2 style="font-size: 18px; font-weight: 900; margin: 0;">DATA DE GERAÇÃO</h2>
            <p style="font-size: 12px; font-weight: 600;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Peça</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center;">Qtd</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Custo</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Venda</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Inv. Total</th>
            </tr>
          </thead>
          <tbody>
            ${inventory.map(i => `
              <tr style="border-bottom: 1px solid #f1f5f9; ${i.quantity <= i.minStock ? 'background: #fff1f2;' : ''}">
                <td style="padding: 10px;">
                  <span style="font-weight: 700;">${i.name}</span>
                  ${i.quantity <= i.minStock ? '<br><span style="color: #dc2626; font-size: 9px; font-weight: 800;">[ESTOQUE BAIXO]</span>' : ''}
                </td>
                <td style="padding: 10px; text-align: center;">${i.quantity}</td>
                <td style="padding: 10px; text-align: right;">R$ ${i.costPrice.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right;">R$ ${i.sellPrice.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 700;">R$ ${(i.quantity * i.costPrice).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-top: 40px;">
          <div style="width: 300px; padding: 20px; background: #f8fafc; border: 2px solid #0f172a; border-radius: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;"><span>Total de Itens:</span> <span>${totalItems} un</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #dc2626; border-top: 1px solid #cbd5e1; pt-2; margin-top: 8px;">
               <span>Investimento:</span> <span>R$ ${totalInvestment.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(printArea, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      window.open(pdf.output('bloburl'), '_blank');
    } catch (err) {
      console.error(err);
      window.print();
    } finally {
      printArea.style.display = 'none';
    }
  };

  const handlePrintReminders = async () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    printArea.style.display = 'block';
    printArea.style.position = 'fixed';
    printArea.style.left = '-5000px';
    printArea.style.top = '0';
    printArea.style.width = '210mm';

    printArea.innerHTML = `
      <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #0f172a; background: white; width: 210mm; min-height: 297mm; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 24px; margin-bottom: 32px;">
          <div>
            <h1 style="font-size: 32px; font-weight: 900; color: #dc2626; margin: 0; letter-spacing: -1px;">MAQARA</h1>
            <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px;">Relatório de Lembretes de Peças</p>
          </div>
          <div style="text-align: right;">
            <h2 style="font-size: 18px; font-weight: 900; margin: 0;">DATA DE GERAÇÃO</h2>
            <p style="font-size: 12px; font-weight: 600;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Peça</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center;">Qtd</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Observações</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${reminders.map(r => `
              <tr style="border-bottom: 1px solid #f1f5f9; ${r.status === PartReminderStatus.PENDING ? 'background: #fff1f2;' : ''}">
                <td style="padding: 10px; font-weight: 700;">${r.partName}</td>
                <td style="padding: 10px; text-align: center;">${r.quantity}</td>
                <td style="padding: 10px;">${r.notes || '---'}</td>
                <td style="padding: 10px; text-align: center;">
                  <span style="font-weight: 800; text-transform: uppercase; font-size: 9px; padding: 4px 8px; border-radius: 4px; ${
                    r.status === PartReminderStatus.PENDING ? 'color: #be123c; background: #ffe4e6;' : 
                    r.status === PartReminderStatus.ORDERED ? 'color: #1d4ed8; background: #dbeafe;' : 
                    'color: #15803d; background: #dcfce7;'
                  }">${r.status}</span>
                </td>
              </tr>
            `).join('')}
            ${reminders.length === 0 ? '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8;">Nenhum lembrete encontrado.</td></tr>' : ''}
          </tbody>
        </table>

        <div style="margin-top: 60px; text-align: center; font-size: 9px; color: #94a3b8;">
           MaqAra Manager - Sistema Profissional de Gestão de Assistência Técnica
        </div>
      </div>
    `;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(printArea, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      window.open(pdf.output('bloburl'), '_blank');
    } catch (err) {
      console.error(err);
      window.print();
    } finally {
      printArea.style.display = 'none';
      printArea.innerHTML = '';
    }
  };

  const handlePrintOS = async (os: ServiceOrder) => {
    const client = clients.find(c => c.id === os.clientId);
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    printArea.style.display = 'block';
    printArea.style.position = 'fixed';
    printArea.style.left = '-5000px';
    printArea.style.top = '0';
    printArea.style.width = '210mm';

    printArea.innerHTML = `
      <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #0f172a; background: white; width: 210mm; min-height: 297mm; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 24px; margin-bottom: 32px;">
          <div>
            <h1 style="font-size: 32px; font-weight: 900; color: #dc2626; margin: 0; letter-spacing: -1px;">MAQARA</h1>
            <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px;">Gestão de Assistência Técnica</p>
          </div>
          <div style="text-align: right;">
            <h2 style="font-size: 20px; font-weight: 900; margin: 0;">ORDEM DE SERVIÇO</h2>
            <p style="font-size: 18px; font-weight: 900; color: #dc2626; margin: 4px 0;">#${os.id}</p>
            <p style="font-size: 12px; font-weight: 600;">Data: ${new Date(os.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px;">
          <div>
            <h3 style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">Dados do Cliente</h3>
            <p style="font-size: 14px; font-weight: 700; margin: 0;">${client?.name || 'Cliente N/A'}</p>
            <p style="font-size: 12px; margin: 4px 0;">Tel: ${client?.phone || 'N/A'}</p>
            <p style="font-size: 12px; margin: 0;">Email: ${client?.email || 'N/A'}</p>
          </div>
          <div>
            <h3 style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">Equipamento</h3>
            <p style="font-size: 14px; font-weight: 700; margin: 0;">${os.printerModel}</p>
            <p style="font-size: 12px; margin: 4px 0;">Série: ${os.serialNumber || 'N/A'}</p>
            <p style="font-size: 12px; margin: 0;">Prioridade: ${os.priority}</p>
          </div>
        </div>

        <div style="margin-bottom: 32px;">
          <h3 style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">Relato do Problema</h3>
          <p style="font-size: 13px; font-style: italic; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin: 0;">"${os.problemDescription}"</p>
        </div>

        <div style="margin-bottom: 32px;">
          <h3 style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">Diagnóstico Técnico</h3>
          <p style="font-size: 13px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin: 0; min-height: 80px;">${os.diagnosis || 'Em análise técnica.'}</p>
        </div>

        <div style="margin-bottom: 32px;">
          <h3 style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">Peças Utilizadas</h3>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left;">
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Item</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center;">Qtd</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">V. Unit.</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(os.partsUsed || []).map(p => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px;">${p.name}</td>
                  <td style="padding: 10px; text-align: center;">${p.quantity}</td>
                  <td style="padding: 10px; text-align: right;">R$ ${p.unitPrice.toFixed(2)}</td>
                  <td style="padding: 10px; text-align: right; font-weight: 700;">R$ ${(p.quantity * p.unitPrice).toFixed(2)}</td>
                </tr>
              `).join('')}
              ${(os.partsUsed || []).length === 0 ? '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8;">Nenhuma peça utilizada.</td></tr>' : ''}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; margin-bottom: 80px;">
          <div style="font-size: 12px; font-weight: 700; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
             Status: <span style="color: #dc2626; text-transform: uppercase;">${os.status}</span>
          </div>
          <div style="width: 250px; padding: 16px; background: #f1f5f9; border: 2px solid #0f172a; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;"><span>Mão de Obra:</span> <span>R$ ${os.laborCost.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1;"><span>Subtotal Peças:</span> <span>R$ ${os.partsCost.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; color: #dc2626;"><span>TOTAL:</span> <span>R$ ${os.totalCost.toFixed(2)}</span></div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px;">
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 8px;">
            <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; margin: 0;">Assinatura do Técnico</p>
          </div>
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 8px;">
            <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; margin: 0;">Assinatura do Cliente</p>
          </div>
        </div>
        
        <div style="margin-top: 60px; text-align: center; font-size: 9px; color: #94a3b8;">
           MaqAra Manager - Sistema Profissional de Gestão de Assistência Técnica
        </div>
      </div>
    `;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(printArea, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      window.open(pdf.output('bloburl'), '_blank');
    } catch (error) {
      console.error('Falha ao gerar PDF:', error);
      window.print();
    } finally {
      printArea.style.display = 'none';
      printArea.innerHTML = '';
    }
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

  const handleAddMachineToDraft = () => {
    const typeInput = document.getElementById('machine-type') as HTMLInputElement;
    const modelInput = document.getElementById('machine-model') as HTMLInputElement;
    const serialInput = document.getElementById('machine-serial') as HTMLInputElement;

    if (!typeInput.value || !modelInput.value) {
      alert('Tipo e Modelo são obrigatórios.');
      return;
    }

    const newMachine: Machine = { id: Date.now().toString(), type: typeInput.value, model: modelInput.value, serialNumber: serialInput.value };
    setClientMachinesDraft(prev => [...prev, newMachine]);
    typeInput.value = '';
    modelInput.value = '';
    serialInput.value = '';
  };

  const handleRemoveMachineFromDraft = (id: string) => {
    setClientMachinesDraft(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans print:bg-white">
      {/* Sidebar */}
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
              {activeTab === 'orders' && <button onClick={() => { setClientSearch(''); setSelectedClientId(''); setSelectedMachineId(''); setIsOrderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Nova OS</button>}
              {activeTab === 'clients' && <button onClick={() => { setClientMachinesDraft([]); setIsClientModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Cliente</button>}
              {activeTab === 'inventory' && (
                <div className="flex gap-2">
                  <button onClick={handlePrintInventory} className="bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 shadow-sm flex items-center gap-2"><Printer size={20}/> Relatório</button>
                  <button onClick={() => setIsInventoryModalOpen(true)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Item</button>
                </div>
              )}
              {activeTab === 'reminders' && (
                <div className="flex gap-2">
                  <button onClick={handlePrintReminders} className="p-3 bg-white text-slate-400 hover:text-red-600 border border-slate-200 rounded-xl transition-all shadow-sm">
                    <Printer size={20}/>
                  </button>
                  <button onClick={() => { setEditingReminder(null); setIsReminderModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-xl flex items-center gap-2"><PlusCircle size={20}/> Novo Lembrete</button>
                </div>
              )}
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
                  <tr><th className="p-6">Nome do Cliente</th><th className="p-6">WhatsApp</th><th className="p-6">Máquinas</th><th className="p-6 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients?.length === 0 ? (
                    <tr><td colSpan={4} className="p-20 text-center text-slate-400 italic">Nenhum cliente cadastrado.</td></tr>
                  ) : clients?.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-6 font-black">{c.name}</td>
                      <td className="p-6 font-bold text-slate-600">{c.phone}</td>
                      <td className="p-6 font-bold text-xs">{(c.machines || []).length} cadastradas</td>
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

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-2">
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Informações do Equipamento</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-slate-500 font-bold">Modelo</p><p className="font-bold text-sm">{editingOrder.printerModel}</p></div>
                    <div><p className="text-xs text-slate-500 font-bold">N/S</p><p className="font-bold text-sm">{editingOrder.serialNumber || 'N/A'}</p></div>
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

      {/* Modal Nova OS */}
      <SaaSModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Nova Ordem de Serviço">
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          const formData = new FormData(e.currentTarget); 
          const osId = formData.get('osId') as string;
          
          if (!osId) { alert('Informe o número da OS.'); return; }
          if (orders.some(o => o.id === osId)) { alert('Este número de OS já existe. Escolha outro.'); return; }
          if (!selectedClientId) { alert('Selecione um cliente.'); return; }
          
          const client = clients.find(c => c.id === selectedClientId);
          const machine = client?.machines?.find(m => m.id === selectedMachineId);
          
          if (!selectedMachineId) { alert('Selecione uma máquina do cliente.'); return; }

          const newOrder: ServiceOrder = { 
            id: osId, 
            clientId: selectedClientId, 
            machineId: selectedMachineId,
            printerModel: machine?.model || 'Modelo não especificado', 
            serialNumber: machine?.serialNumber || 'N/S não especificado', 
            problemDescription: formData.get('problemDescription') as string, 
            status: OrderStatus.PENDING, 
            history: [{ status: OrderStatus.PENDING, date: new Date(), user: 'Recepção' }], 
            priority: formData.get('priority') as any || 'Normal', 
            laborCost: 0, 
            partsCost: 0, 
            totalCost: 0, 
            partsUsed: [], 
            createdAt: new Date(), 
            updatedAt: new Date() 
          }; 
          updateState('orders', [newOrder, ...orders]); 
          setIsOrderModalOpen(false); 
          setClientSearch(''); 
          setSelectedClientId(''); 
          setSelectedMachineId('');
        }} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase">Número da OS</label>
              <input name="osId" type="text" pattern="[0-9]*" inputMode="numeric" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-red-600 text-lg" placeholder="Digite o número da OS..." required />
            </div>

            <div className="space-y-1 relative"><label className="text-[10px] font-black uppercase">1. Buscar Cliente</label><input type="text" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); if (selectedClientId) { setSelectedClientId(''); setSelectedMachineId(''); } }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome do cliente..." />{showClientResults && filteredClients.length > 0 && (<div className="absolute top-full left-0 right-0 z-[210] mt-2 bg-white border rounded-2xl shadow-2xl max-h-48 overflow-y-auto">{filteredClients.map(c => (<div key={c.id} onClick={() => { setClientSearch(c.name); setSelectedClientId(c.id); setShowClientResults(false); }} className="p-4 hover:bg-red-50 cursor-pointer font-bold border-b">{c.name}</div>))}</div>)}</div>
            
            {selectedClientId && (
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase">2. Selecionar Máquina</label>
                 <select value={selectedMachineId} onChange={(e) => setSelectedMachineId(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                    <option value="">Selecione o equipamento...</option>
                    {(clients.find(c => c.id === selectedClientId)?.machines || []).map(m => (
                      <option key={m.id} value={m.id}>{m.type} - {m.model} (SN: {m.serialNumber || 'N/A'})</option>
                    ))}
                 </select>
                 {(clients.find(c => c.id === selectedClientId)?.machines || []).length === 0 && <p className="text-[10px] text-red-600 font-bold">Este cliente não possui máquinas cadastradas. Vá em 'Clientes' para adicionar.</p>}
               </div>
            )}
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black uppercase">Prioridade</label><select name="priority" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold"><option value="Normal">Normal</option><option value="Baixa">Baixa</option><option value="Alta">Alta</option></select></div>
          <textarea name="problemDescription" rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Descreva o problema relatado..." required />
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Salvar e Iniciar OS</button>
        </form>
      </SaaSModal>

      {/* Outros modais mantidos */}
      <SaaSModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Gerenciar Cliente e Máquinas">
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          const formData = new FormData(e.currentTarget); 
          const newClient: Client = { 
            id: Date.now().toString(), 
            name: formData.get('name') as string, 
            phone: formData.get('phone') as string, 
            email: formData.get('email') as string,
            machines: clientMachinesDraft
          };
          updateState('clients', [...clients, newClient]); 
          setIsClientModalOpen(false); 
          setClientMachinesDraft([]);
        }} className="space-y-6">
          <div className="space-y-4">
            <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome Completo" required />
            <input name="phone" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="WhatsApp" required />
          </div>
          <div className="border-t pt-6 space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400">Equipamentos do Cliente</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input id="machine-type" type="text" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" placeholder="Tipo (Ex: Impressora)" />
              <input id="machine-model" type="text" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" placeholder="Modelo (Ex: L3250)" />
              <div className="flex gap-2">
                <input id="machine-serial" type="text" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" placeholder="Serial" />
                <button type="button" onClick={handleAddMachineToDraft} className="bg-slate-900 text-white p-3 rounded-xl"><Plus size={18}/></button>
              </div>
            </div>
            <div className="space-y-2">
              {clientMachinesDraft.map(m => (
                <div key={m.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border">
                  <div><p className="font-bold text-sm">{m.type} - {m.model}</p><p className="text-[10px] text-slate-400">SN: {m.serialNumber || 'N/A'}</p></div>
                  <button type="button" onClick={() => handleRemoveMachineFromDraft(m.id)} className="text-red-600"><MinusCircle size={18}/></button>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Cadastrar Cliente</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Novo Item de Estoque">
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); updateState('inventory', [...inventory, { id: Date.now().toString(), name: formData.get('name') as string, quantity: parseInt(formData.get('quantity') as string), minStock: parseInt(formData.get('minStock') as string), costPrice: parseFloat(formData.get('costPrice') as string), sellPrice: parseFloat(formData.get('sellPrice') as string) }]); setIsInventoryModalOpen(false); }} className="space-y-6">
          <input name="name" type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça" required />
          <div className="grid grid-cols-2 gap-4"><input name="quantity" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Quantidade Atual" required /><input name="minStock" type="number" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Estoque Mínimo" /></div>
          <div className="grid grid-cols-2 gap-4">
             <input name="costPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço de Custo" required />
             <input name="sellPrice" type="number" step="0.01" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Preço de Venda" required />
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">Adicionar ao Estoque</button>
        </form>
      </SaaSModal>

      <SaaSModal isOpen={isReminderModalOpen} onClose={() => setIsReminderModalOpen(false)} title={editingReminder ? "Editar Lembrete" : "Novo Lembrete de Peça"}>
        <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); const reminderData = { partName: formData.get('partName') as string, quantity: parseInt(formData.get('quantity') as string), notes: formData.get('notes') as string, status: editingReminder ? editingReminder.status : PartReminderStatus.PENDING }; if (editingReminder) { updateState('reminders', reminders.map(r => r.id === editingReminder.id ? { ...r, ...reminderData } : r)); } else { updateState('reminders', [{ id: Date.now().toString(), ...reminderData, createdAt: new Date() }, ...reminders]); } setIsReminderModalOpen(false); }} className="space-y-6">
          <input name="partName" defaultValue={editingReminder?.partName} type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Nome da Peça para pedido" required />
          <input name="quantity" defaultValue={editingReminder?.quantity} type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Quantidade necessária" required />
          <textarea name="notes" defaultValue={editingReminder?.notes} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Observações (opcional)" rows={3}></textarea>
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl">{editingReminder ? 'Atualizar' : 'Criar Lembrete'}</button>
        </form>
      </SaaSModal>
    </div>
  );
}

// Subcomponentes
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
