export enum OrderStatus {
  PENDING = 'Pendente',
  DIAGNOSING = 'Em Diagnóstico',
  WAITING_APPROVAL = 'Aguardando Aprovação',
  IN_REPAIR = 'Em Reparo',
  READY = 'Pronto',
  DELIVERED = 'Entregue'
}

export enum PartReminderStatus {
  PENDING = 'Pendente',
  ORDERED = 'Pedido',
  RECEIVED = 'Recebido'
}

export interface PartReminder {
  id: string;
  partName: string;
  quantity: number;
  notes?: string;
  status: PartReminderStatus;
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  costPrice: number;
  sellPrice: number;
  minStock: number;
}

export interface UsedPart {
  inventoryItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  date: Date;
  user: string;
  description?: string;
}

export interface ServiceOrder {
  id: string;
  clientId: string;
  printerModel: string;
  serialNumber: string;
  problemDescription: string;
  diagnosis?: string;
  status: OrderStatus;
  history: StatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  partsUsed: UsedPart[];
  technicalNotes?: string;
  priority: 'Baixa' | 'Normal' | 'Alta';
}

export interface DashboardStats {
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  lowStockItems: number;
}