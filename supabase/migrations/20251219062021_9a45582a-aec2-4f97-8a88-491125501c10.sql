-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for client type
CREATE TYPE public.client_type AS ENUM ('domestic', 'foreign');

-- Create enum for invoice type (products or services)
CREATE TYPE public.invoice_item_type AS ENUM ('products', 'services');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for admin access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create companies table (one user can have multiple companies)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  pib TEXT NOT NULL,
  maticni_broj TEXT NOT NULL,
  bank_account TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  pib TEXT,
  client_type client_type NOT NULL DEFAULT 'domestic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_date DATE,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_pib TEXT,
  client_type client_type NOT NULL DEFAULT 'domestic',
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  foreign_currency TEXT,
  foreign_amount DECIMAL(15,2),
  exchange_rate DECIMAL(15,6),
  item_type invoice_item_type NOT NULL DEFAULT 'services',
  payment_deadline DATE,
  payment_method TEXT,
  note TEXT DEFAULT 'Obveznik nije u sistemu PDV-a u skladu sa članom 33. Zakona o PDV-u.',
  is_proforma BOOLEAN NOT NULL DEFAULT false,
  converted_from_proforma UUID REFERENCES public.invoices(id),
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create KPO entries table (auto-generated from invoices)
CREATE TABLE public.kpo_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  ordinal_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  products_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  services_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, year, ordinal_number)
);

-- Create payment reminders table
CREATE TABLE public.payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(15,2),
  due_date DATE NOT NULL,
  reminder_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpo_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND status = 'approved'
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow insert for new users"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for companies
CREATE POLICY "Users can view own companies"
ON public.companies FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "Users can insert own companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "Users can update own companies"
ON public.companies FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "Users can delete own companies"
ON public.companies FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "Admins can view all companies"
ON public.companies FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for clients
CREATE POLICY "Users can manage own clients"
ON public.clients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = clients.company_id
    AND companies.user_id = auth.uid()
  ) AND public.is_approved(auth.uid())
);

-- RLS Policies for invoices
CREATE POLICY "Users can manage own invoices"
ON public.invoices FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = invoices.company_id
    AND companies.user_id = auth.uid()
  ) AND public.is_approved(auth.uid())
);

-- RLS Policies for kpo_entries
CREATE POLICY "Users can manage own KPO entries"
ON public.kpo_entries FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = kpo_entries.company_id
    AND companies.user_id = auth.uid()
  ) AND public.is_approved(auth.uid())
);

-- RLS Policies for payment_reminders
CREATE POLICY "Users can manage own reminders"
ON public.payment_reminders FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = payment_reminders.company_id
    AND companies.user_id = auth.uid()
  ) AND public.is_approved(auth.uid())
);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'pending'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create function to auto-generate KPO entry when invoice is created
CREATE OR REPLACE FUNCTION public.create_kpo_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_ordinal INTEGER;
  client_name TEXT;
BEGIN
  -- Only create KPO for non-proforma invoices
  IF NEW.is_proforma = false THEN
    -- Get next ordinal number for the company and year
    SELECT COALESCE(MAX(ordinal_number), 0) + 1
    INTO next_ordinal
    FROM public.kpo_entries
    WHERE company_id = NEW.company_id AND year = NEW.year;

    -- Get client name
    client_name := NEW.client_name;

    -- Insert KPO entry
    INSERT INTO public.kpo_entries (
      company_id,
      invoice_id,
      ordinal_number,
      description,
      products_amount,
      services_amount,
      total_amount,
      year
    ) VALUES (
      NEW.company_id,
      NEW.id,
      next_ordinal,
      'Faktura ' || NEW.invoice_number || ', ' || TO_CHAR(COALESCE(NEW.service_date, NEW.issue_date), 'DD.MM.YYYY') || ', ' || client_name,
      CASE WHEN NEW.item_type = 'products' THEN NEW.total_amount ELSE 0 END,
      CASE WHEN NEW.item_type = 'services' THEN NEW.total_amount ELSE 0 END,
      NEW.total_amount
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for KPO auto-generation
CREATE TRIGGER on_invoice_created
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.create_kpo_entry();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();