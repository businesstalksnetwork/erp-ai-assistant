import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { useCompanies, Company } from '@/hooks/useCompanies';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companies, isLoading } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (companies.length > 0 && !selectedCompany) {
      const activeCompany = companies.find(c => c.is_active) || companies[0];
      setSelectedCompany(activeCompany);
    }
  }, [companies, selectedCompany]);

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany,
        companies,
        isLoading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useSelectedCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useSelectedCompany must be used within a CompanyProvider');
  }
  return context;
}
