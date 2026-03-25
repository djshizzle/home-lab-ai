export interface Supplier {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naicsCodes: string[];
  capabilities: string;
  status: 'active' | 'pending' | 'inactive' | 'suspended';
  certifications: SupplierCertification[];
  notes: Note[];
  createdAt: string;
  updatedAt: string;
}

export interface CertificationType {
  id: string;
  code: string;
  label: string;
  color: string;
}

export interface SupplierCertification {
  certTypeId: string;
  certNumber: string;
  issuedDate: string;
  expirationDate: string;
  documentUrl?: string;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  supplierId: string;
  projectId: string;
  amount: number;
  tier: 1 | 2 | 3;
  description: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  contractNumber: string;
  contractValue: number;
  description: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'archived';
  goals: ContractGoal[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractGoal {
  id: string;
  certTypeId: string;
  targetPercentage: number | null;
  targetDollarAmount: number | null;
  goalType: 'percentage' | 'dollar' | 'both';
}

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  goals: Omit<ContractGoal, 'id'>[];
}

export interface ColumnMapping {
  id: string;
  name: string;
  sourceType: 'generic' | 'procore-budget' | 'procore-commitment' | 'procore-direct-cost';
  mappings: Record<string, string>;
}

export interface ImportPreview {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export type AppData = {
  suppliers: Supplier[];
  transactions: Transaction[];
  projects: Project[];
  certificationTypes: CertificationType[];
  goalTemplates: GoalTemplate[];
  columnMappings: ColumnMapping[];
};
