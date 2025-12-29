import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { useCompanies, Company } from '@/hooks/useCompanies';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  myCompanies: Company[];
  clientCompanies: Company[];
  isLoading: boolean;
  isViewingClientCompany: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companies, myCompanies, clientCompanies, isLoading } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (myCompanies.length > 0 && !selectedCompany) {
      const activeCompany = myCompanies.find(c => c.is_active) || myCompanies[0];
      setSelectedCompany(activeCompany);
    }
  }, [myCompanies, selectedCompany]);

  // Update selectedCompany when companies data changes (e.g., after logo upload)
  useEffect(() => {
    if (selectedCompany) {
      const updatedCompany = companies.find(c => c.id === selectedCompany.id);
      if (updatedCompany && JSON.stringify(updatedCompany) !== JSON.stringify(selectedCompany)) {
        setSelectedCompany(updatedCompany);
      }
    }
  }, [companies]);

  const isViewingClientCompany = selectedCompany?.is_client_company || false;

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany,
        companies,
        myCompanies,
        clientCompanies,
        isLoading,
        isViewingClientCompany,
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
