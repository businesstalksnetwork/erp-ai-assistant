import { ReactNode, createContext, useContext, useState, useEffect, useRef } from 'react';
import { useCompanies, Company } from '@/hooks/useCompanies';

const SELECTED_COMPANY_KEY = 'pausalbox_selected_company_id';

// Sinhrono čitanje sačuvanog ID-ja pri inicijalizaciji
const getSavedCompanyId = () => localStorage.getItem(SELECTED_COMPANY_KEY);

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
  
  // Sačuvaj ID odmah pri mount-u da znamo koju kompaniju tražimo
  const savedCompanyIdRef = useRef<string | null>(getSavedCompanyId());
  const initialLoadDone = useRef(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Load saved company ID from localStorage and set the company when data is available
  useEffect(() => {
    if (companies.length === 0) return;
    
    const savedCompanyId = savedCompanyIdRef.current;
    
    // Pri prvom učitavanju
    if (!initialLoadDone.current) {
      // Pokušaj da nađeš sačuvanu kompaniju
      if (savedCompanyId) {
        const savedCompany = companies.find(c => c.id === savedCompanyId);
        if (savedCompany) {
          setSelectedCompany(savedCompany);
          initialLoadDone.current = true;
          return;
        }
        // Sačuvana kompanija ne postoji više - obriši stari ID iz storage-a
        localStorage.removeItem(SELECTED_COMPANY_KEY);
        savedCompanyIdRef.current = null;
      }
      
      // Fallback: izaberi aktivnu ili prvu kompaniju iz myCompanies
      if (myCompanies.length > 0) {
        const activeCompany = myCompanies.find(c => c.is_active) || myCompanies[0];
        setSelectedCompany(activeCompany);
        localStorage.setItem(SELECTED_COMPANY_KEY, activeCompany.id);
      }
      
      initialLoadDone.current = true;
    }
  }, [companies, myCompanies]);

  // Update selectedCompany when companies data changes (e.g., after logo upload)
  useEffect(() => {
    if (selectedCompany) {
      const updatedCompany = companies.find(c => c.id === selectedCompany.id);
      if (updatedCompany && JSON.stringify(updatedCompany) !== JSON.stringify(selectedCompany)) {
        setSelectedCompany(updatedCompany);
      }
    }
  }, [companies]);

  // Wrapper to persist selection to localStorage
  const handleSetSelectedCompany = (company: Company | null) => {
    setSelectedCompany(company);
    if (company) {
      localStorage.setItem(SELECTED_COMPANY_KEY, company.id);
    } else {
      localStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  };

  const isViewingClientCompany = selectedCompany?.is_client_company || false;

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany: handleSetSelectedCompany,
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
