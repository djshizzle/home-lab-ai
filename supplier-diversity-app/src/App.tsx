import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import SupplierList from './pages/suppliers/SupplierList'
import SupplierForm from './pages/suppliers/SupplierForm'
import SupplierDetail from './pages/suppliers/SupplierDetail'
import TransactionList from './pages/spend/TransactionList'
import TransactionForm from './pages/spend/TransactionForm'
import SpendImport from './pages/spend/SpendImport'
import ProjectList from './pages/projects/ProjectList'
import ProjectDetail from './pages/projects/ProjectDetail'
import ProjectForm from './pages/projects/ProjectForm'
import ComplianceReport from './pages/reports/ComplianceReport'
import SpendAnalysis from './pages/reports/SpendAnalysis'
import SupplierReport from './pages/reports/SupplierReport'
import CertificationSettings from './pages/settings/CertificationSettings'
import DataManagement from './pages/settings/DataManagement'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/suppliers" element={<SupplierList />} />
        <Route path="/suppliers/new" element={<SupplierForm />} />
        <Route path="/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/suppliers/:id/edit" element={<SupplierForm />} />
        <Route path="/spend" element={<TransactionList />} />
        <Route path="/spend/new" element={<TransactionForm />} />
        <Route path="/spend/:id/edit" element={<TransactionForm />} />
        <Route path="/spend/import" element={<SpendImport />} />
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/projects/new" element={<ProjectForm />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/edit" element={<ProjectForm />} />
        <Route path="/reports/compliance" element={<ComplianceReport />} />
        <Route path="/reports/spend-analysis" element={<SpendAnalysis />} />
        <Route path="/reports/suppliers" element={<SupplierReport />} />
        <Route path="/settings/certifications" element={<CertificationSettings />} />
        <Route path="/settings/data" element={<DataManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
