import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type {
  AppData,
  Supplier,
  Transaction,
  Project,
  CertificationType,
  GoalTemplate,
  ColumnMapping,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Default certification types
// ---------------------------------------------------------------------------

const DEFAULT_CERT_TYPES: CertificationType[] = [
  { id: 'cert-mbe', code: 'MBE', label: 'Minority Business Enterprise', color: 'blue-600' },
  { id: 'cert-wbe', code: 'WBE', label: 'Women Business Enterprise', color: 'pink-600' },
  { id: 'cert-sbe', code: 'SBE', label: 'Small Business Enterprise', color: 'green-600' },
  { id: 'cert-vbe', code: 'VBE', label: 'Veteran Business Enterprise', color: 'purple-600' },
  { id: 'cert-dbe', code: 'DBE', label: 'Disadvantaged Business Enterprise', color: 'orange-600' },
  { id: 'cert-aabe', code: 'AABE', label: 'African American Business Enterprise', color: 'red-600' },
];

const INITIAL_STATE: AppData = {
  suppliers: [],
  transactions: [],
  projects: [],
  certificationTypes: DEFAULT_CERT_TYPES,
  goalTemplates: [],
  columnMappings: [],
};

const STORAGE_KEY = 'supplier-diversity-data';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'DELETE_SUPPLIER'; payload: string }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'ADD_CERT_TYPE'; payload: CertificationType }
  | { type: 'UPDATE_CERT_TYPE'; payload: CertificationType }
  | { type: 'DELETE_CERT_TYPE'; payload: string }
  | { type: 'ADD_GOAL_TEMPLATE'; payload: GoalTemplate }
  | { type: 'UPDATE_GOAL_TEMPLATE'; payload: GoalTemplate }
  | { type: 'DELETE_GOAL_TEMPLATE'; payload: string }
  | { type: 'ADD_COLUMN_MAPPING'; payload: ColumnMapping }
  | { type: 'IMPORT_SUPPLIERS'; payload: Supplier[] }
  | { type: 'IMPORT_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'LOAD_DATA'; payload: AppData }
  | { type: 'RESET_DATA' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function appReducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    // Suppliers
    case 'ADD_SUPPLIER':
      return { ...state, suppliers: [...state.suppliers, action.payload] };
    case 'UPDATE_SUPPLIER':
      return {
        ...state,
        suppliers: state.suppliers.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case 'DELETE_SUPPLIER':
      return { ...state, suppliers: state.suppliers.filter((s) => s.id !== action.payload) };

    // Transactions
    case 'ADD_TRANSACTION':
      return { ...state, transactions: [...state.transactions, action.payload] };
    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
      };

    // Projects
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter((p) => p.id !== action.payload) };

    // Certification types
    case 'ADD_CERT_TYPE':
      return { ...state, certificationTypes: [...state.certificationTypes, action.payload] };
    case 'UPDATE_CERT_TYPE':
      return {
        ...state,
        certificationTypes: state.certificationTypes.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case 'DELETE_CERT_TYPE':
      return {
        ...state,
        certificationTypes: state.certificationTypes.filter((c) => c.id !== action.payload),
      };

    // Goal templates
    case 'ADD_GOAL_TEMPLATE':
      return { ...state, goalTemplates: [...state.goalTemplates, action.payload] };
    case 'UPDATE_GOAL_TEMPLATE':
      return {
        ...state,
        goalTemplates: state.goalTemplates.map((g) =>
          g.id === action.payload.id ? action.payload : g
        ),
      };
    case 'DELETE_GOAL_TEMPLATE':
      return {
        ...state,
        goalTemplates: state.goalTemplates.filter((g) => g.id !== action.payload),
      };

    // Column mappings
    case 'ADD_COLUMN_MAPPING':
      return { ...state, columnMappings: [...state.columnMappings, action.payload] };

    // Bulk imports
    case 'IMPORT_SUPPLIERS':
      return { ...state, suppliers: [...state.suppliers, ...action.payload] };
    case 'IMPORT_TRANSACTIONS':
      return { ...state, transactions: [...state.transactions, ...action.payload] };

    // Load / reset
    case 'LOAD_DATA':
      return action.payload;
    case 'RESET_DATA':
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AppContextValue {
  state: AppData;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function loadFromStorage(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as AppData;
    }
  } catch {
    // Corrupted data — fall through to defaults
  }
  return INITIAL_STATE;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota exceeded or unavailable — silently ignore
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside <AppProvider>');
  }
  return ctx;
}
