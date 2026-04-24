-- Schema Supabase pour Novae SaaS
-- Activer Row Level Security (RLS)

-- Extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des utilisateurs (extension de auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Données du diagnostic/onboarding
  onboarding_data JSONB,
  
  -- Métadonnées
  subscription_tier TEXT DEFAULT 'free', -- free, premium, pro
  subscription_status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  
  -- Préférences
  preferences JSONB DEFAULT '{}',
  
  -- Index
  CONSTRAINT users_email_check CHECK (email IS NOT NULL)
);

-- Table de progression du programme 90 jours
CREATE TABLE public.program_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  current_day INTEGER DEFAULT 1,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_access_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_missions INTEGER DEFAULT 0,
  
  -- Réponses aux missions (JSON pour flexibilité)
  mission_responses JSONB DEFAULT '[]',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT program_progress_current_day_check CHECK (current_day >= 1 AND current_day <= 90),
  CONSTRAINT program_progress_user_unique UNIQUE (user_id)
);

-- Table des tâches (planning)
CREATE TABLE public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Données de la tâche
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('self', 'family', 'pro', 'social')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  
  -- Planning
  date DATE,
  start_hour INTEGER,
  duration_hours DECIMAL(3,1) DEFAULT 1,
  
  -- Métadonnées
  color TEXT DEFAULT '#F4D0D4',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index
  CONSTRAINT tasks_duration_check CHECK (duration_hours > 0 AND duration_hours <= 24),
  CONSTRAINT tasks_hour_check CHECK (start_hour >= 0 AND start_hour <= 23)
);

-- Table des plans de repas
CREATE TABLE public.meal_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Planning hebdomadaire
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('lunch', 'dinner')),
  
  -- Référence à la recette
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  
  -- Si pas de recette, description libre
  custom_meal TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unicité
  CONSTRAINT meal_plans_user_day_meal_unique UNIQUE (user_id, day_of_week, meal_type)
);

-- Table des recettes
CREATE TABLE public.recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL pour recettes publiques
  
  -- Informations de base
  title TEXT NOT NULL,
  description TEXT,
  prep_time TEXT, -- "15 min", "30 min"
  cook_time TEXT,
  total_time TEXT,
  
  -- Catégories
  category TEXT CHECK (category IN ('express', 'healthy', 'family', 'vegetarian', 'vegan')),
  meal_type TEXT CHECK (meal_type IN ('entree', 'plat', 'dessert', 'accompagnement')),
  
  -- Contenu
  ingredients JSONB DEFAULT '[]', -- Array de strings
  steps JSONB DEFAULT '[]', -- Array de strings
  
  -- Nutrition
  calories INTEGER,
  proteins DECIMAL(5,1),
  carbs DECIMAL(5,1),
  fats DECIMAL(5,1),
  
  -- Métadonnées
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  difficulty TEXT CHECK (difficulty IN ('facile', 'moyen', 'difficile')),
  servings INTEGER DEFAULT 4,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des listes de courses
CREATE TABLE public.shopping_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Item
  ingredient TEXT NOT NULL,
  quantity TEXT,
  category TEXT,
  
  -- Status
  checked BOOLEAN DEFAULT false,
  in_stock BOOLEAN DEFAULT false,
  to_buy BOOLEAN DEFAULT true,
  
  -- Association
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des données familiales
CREATE TABLE public.family_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Type de donnée
  data_type TEXT NOT NULL CHECK (data_type IN ('member', 'contact', 'emergency_contact', 'preference')),
  
  -- Données flexibles
  data JSONB NOT NULL,
  
  -- Métadonnées
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des routines
CREATE TABLE public.routines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Routine
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  category TEXT NOT NULL,
  
  -- Status
  completed BOOLEAN DEFAULT false,
  last_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Planning
  preferred_time TIME, -- HH:MM format
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : Les utilisateurs ne voient que leurs propres données

-- Users
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Program Progress
CREATE POLICY "Users can view own program progress" ON public.program_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own program progress" ON public.program_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own program progress" ON public.program_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tasks
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- Meal Plans
CREATE POLICY "Users can view own meal plans" ON public.meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON public.meal_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans" ON public.meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON public.meal_plans FOR DELETE USING (auth.uid() = user_id);

-- Recipes (publiques + privées)
CREATE POLICY "Recipes are viewable by everyone" ON public.recipes FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);

-- Shopping Lists
CREATE POLICY "Users can view own shopping lists" ON public.shopping_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own shopping lists" ON public.shopping_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shopping lists" ON public.shopping_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own shopping lists" ON public.shopping_lists FOR DELETE USING (auth.uid() = user_id);

-- Family Data
CREATE POLICY "Users can view own family data" ON public.family_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own family data" ON public.family_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own family data" ON public.family_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own family data" ON public.family_data FOR DELETE USING (auth.uid() = user_id);

-- Routines
CREATE POLICY "Users can view own routines" ON public.routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own routines" ON public.routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines" ON public.routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines" ON public.routines FOR DELETE USING (auth.uid() = user_id);

-- Index pour optimiser les performances
CREATE INDEX idx_program_progress_user_id ON public.program_progress(user_id);
CREATE INDEX idx_tasks_user_id_date ON public.tasks(user_id, date);
CREATE INDEX idx_meal_plans_user_id ON public.meal_plans(user_id);
CREATE INDEX idx_shopping_lists_user_id ON public.shopping_lists(user_id);
CREATE INDEX idx_family_data_user_id ON public.family_data(user_id);
CREATE INDEX idx_routines_user_id ON public.routines(user_id);
CREATE INDEX idx_recipes_user_id_public ON public.recipes(user_id, is_public);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux tables pertinentes
CREATE TRIGGER handle_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_program_progress_updated_at BEFORE UPDATE ON public.program_progress FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_meal_plans_updated_at BEFORE UPDATE ON public.meal_plans FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_shopping_lists_updated_at BEFORE UPDATE ON public.shopping_lists FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_family_data_updated_at BEFORE UPDATE ON public.family_data FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_routines_updated_at BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
