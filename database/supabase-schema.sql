-- Schema Supabase complet pour Novae SaaS
-- Activer Row Level Security (RLS) sur toutes les tables

-- Extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE UTILISATEURS (extension de auth.users)
-- =============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Données du diagnostic/onboarding
  onboarding_data JSONB DEFAULT '{}',
  
  -- Abonnement SaaS
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'pro')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due')),
  stripe_customer_id TEXT,
  
  -- Préférences utilisateur
  preferences JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'fr',
  
  -- Collecte marketing RGPD
  marketing_consent BOOLEAN DEFAULT FALSE,
  marketing_consent_date TIMESTAMP WITH TIME ZONE,
  
  -- Onboarding complété
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index
  CONSTRAINT users_email_check CHECK (email IS NOT NULL)
);

-- =============================================
-- TABLE PROGRESSION PROGRAMME 90 JOURS
-- =============================================
CREATE TABLE public.program_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Progression actuelle
  current_day INTEGER DEFAULT 1 CHECK (current_day >= 1 AND current_day <= 90),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_access_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_missions INTEGER DEFAULT 0 CHECK (completed_missions >= 0),
  
  -- Réponses aux missions (JSON pour flexibilité)
  mission_responses JSONB DEFAULT '[]',
  
  -- Statistiques
  total_time_spent_minutes INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  
  -- Pour le compagnon IA
  ai_personality_profile JSONB DEFAULT '{}',
  last_ai_interaction TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unicité
  CONSTRAINT program_progress_user_unique UNIQUE (user_id)
);

-- =============================================
-- TABLE TÂCHES (PLANNING)
-- =============================================
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
  start_hour INTEGER CHECK (start_hour >= 0 AND start_hour <= 23),
  duration_hours DECIMAL(3,1) DEFAULT 1 CHECK (duration_hours > 0 AND duration_hours <= 24),
  
  -- Priorité et tags
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags TEXT[] DEFAULT '{}',
  
  -- Métadonnées
  color TEXT DEFAULT '#F4D0D4',
  completed_at TIMESTAMP WITH TIME ZONE,
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE RECETTES
-- =============================================
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
  category TEXT CHECK (category IN ('express', 'healthy', 'family', 'vegetarian', 'vegan', 'gourmet')),
  meal_type TEXT CHECK (meal_type IN ('entree', 'plat', 'dessert', 'accompagnement', 'boisson')),
  difficulty TEXT CHECK (difficulty IN ('facile', 'moyen', 'difficile')),
  servings INTEGER DEFAULT 4 CHECK (servings > 0),
  
  -- Contenu
  ingredients JSONB DEFAULT '[]', -- Array de strings
  steps JSONB DEFAULT '[]', -- Array de strings
  
  -- Nutrition
  calories INTEGER CHECK (calories >= 0),
  proteins DECIMAL(5,1) CHECK (proteins >= 0),
  carbs DECIMAL(5,1) CHECK (carbs >= 0),
  fats DECIMAL(5,1) CHECK (fats >= 0),
  fiber DECIMAL(5,1) CHECK (fiber >= 0),
  
  -- Métadonnées
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
  source TEXT, -- livre, site, famille...
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE PLANS REPAS
-- =============================================
CREATE TABLE public.meal_plan (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Planning hebdomadaire
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('petit_dejeuner', 'dejeuner', 'diner', 'collation')),
  
  -- Référence à la recette
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  
  -- Si pas de recette, description libre
  custom_meal TEXT,
  custom_ingredients JSONB DEFAULT '[]',
  
  -- Nutrition calculée
  estimated_calories INTEGER,
  estimated_proteins DECIMAL(5,1),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unicité
  CONSTRAINT meal_plan_user_day_meal_unique UNIQUE (user_id, day_of_week, meal_type)
);

-- =============================================
-- TABLE LISTE DE COURSES
-- =============================================
CREATE TABLE public.shopping_list (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Item
  ingredient TEXT NOT NULL,
  quantity TEXT,
  unit TEXT, -- g, kg, L, ml, unités...
  category TEXT,
  
  -- Status
  checked BOOLEAN DEFAULT false,
  in_stock BOOLEAN DEFAULT false,
  to_buy BOOLEAN DEFAULT true,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  
  -- Association
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  meal_plan_id UUID REFERENCES public.meal_plan(id) ON DELETE SET NULL,
  
  -- Prix estimé
  estimated_price DECIMAL(8,2) CHECK (estimated_price >= 0),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE DONNÉES FAMILIALES
-- =============================================
CREATE TABLE public.family_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Type de donnée
  data_type TEXT NOT NULL CHECK (data_type IN ('member', 'contact', 'emergency_contact', 'preference', 'allergy', 'restriction')),
  
  -- Données flexibles
  data JSONB NOT NULL DEFAULT '{}',
  
  -- Relations
  relation_to_user TEXT, -- mère, père, enfant, conjoint, ami...
  
  -- Métadonnées
  is_active BOOLEAN DEFAULT true,
  is_primary_contact BOOLEAN DEFAULT false,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE ROUTINES
-- =============================================
CREATE TABLE public.routines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Routine
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  category TEXT NOT NULL,
  
  -- Planning
  preferred_time TIME, -- HH:MM format
  duration_minutes INTEGER CHECK (duration_minutes > 0),
  
  -- Status
  completed BOOLEAN DEFAULT false,
  last_completed_at TIMESTAMP WITH TIME ZONE,
  streak_count INTEGER DEFAULT 0 CHECK (streak_count >= 0),
  
  -- Personnalisation
  custom_days TEXT[], -- Pour frequency 'custom'
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_minutes_before INTEGER DEFAULT 15,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE ÉVÉNEMENTS PLANNER
-- =============================================
CREATE TABLE public.planner_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Événement
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  
  -- Planning
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  
  -- Catégorie et couleur
  category TEXT CHECK (category IN ('work', 'personal', 'family', 'health', 'social', 'other')),
  color TEXT DEFAULT '#F4D0D4',
  
  -- Récurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB DEFAULT '{}', -- Pattern de récurrence RRULE
  
  -- Participants
  attendees JSONB DEFAULT '[]', -- Array d'emails ou noms
  is_private BOOLEAN DEFAULT true,
  
  -- Notifications
  reminder_minutes_before INTEGER[] DEFAULT '{15}', -- Array de minutes
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT planner_events_date_check CHECK (end_date >= start_date)
);

-- =============================================
-- TABLE TO-DO LIST
-- =============================================
CREATE TABLE public.todo_list (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Tâche
  title TEXT NOT NULL,
  description TEXT,
  
  -- Organisation
  category TEXT CHECK (category IN ('self', 'family', 'pro', 'social', 'health', 'home', 'other')),
  project TEXT, -- Pour regrouper par projet
  tags TEXT[] DEFAULT '{}',
  
  -- Priorité et échéance
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  due_time TIME,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Planning
  estimated_duration_minutes INTEGER CHECK (estimated_duration_minutes > 0),
  actual_duration_minutes INTEGER CHECK (actual_duration_minutes >= 0),
  
  -- Sous-tâches
  subtasks JSONB DEFAULT '[]', -- Array de sous-tâches
  completed_subtasks INTEGER DEFAULT 0,
  
  -- Métadonnées
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB DEFAULT '{}',
  parent_todo_id UUID REFERENCES public.todo_list(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ACTIVATION ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_list ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLITIQUES RLS - UTILISATEURS
-- =============================================
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- POLITIQUES RLS - PROGRESSION PROGRAMME
-- =============================================
CREATE POLICY "Users can view own program progress" ON public.program_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own program progress" ON public.program_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own program progress" ON public.program_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - TÂCHES
-- =============================================
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - RECETTES
-- =============================================
CREATE POLICY "Recipes are viewable by everyone" ON public.recipes FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - PLANS REPAS
-- =============================================
CREATE POLICY "Users can view own meal plans" ON public.meal_plan FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON public.meal_plan FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans" ON public.meal_plan FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON public.meal_plan FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - LISTE DE COURSES
-- =============================================
CREATE POLICY "Users can view own shopping list" ON public.shopping_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own shopping list" ON public.shopping_list FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shopping list" ON public.shopping_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own shopping list" ON public.shopping_list FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - DONNÉES FAMILIALES
-- =============================================
CREATE POLICY "Users can view own family data" ON public.family_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own family data" ON public.family_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own family data" ON public.family_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own family data" ON public.family_data FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - ROUTINES
-- =============================================
CREATE POLICY "Users can view own routines" ON public.routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own routines" ON public.routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines" ON public.routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines" ON public.routines FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - ÉVÉNEMENTS PLANNER
-- =============================================
CREATE POLICY "Users can view own planner events" ON public.planner_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own planner events" ON public.planner_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own planner events" ON public.planner_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own planner events" ON public.planner_events FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POLITIQUES RLS - TO-DO LIST
-- =============================================
CREATE POLICY "Users can view own todo list" ON public.todo_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own todo list" ON public.todo_list FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todo list" ON public.todo_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own todo list" ON public.todo_list FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- INDEX POUR OPTIMISATION
-- =============================================
CREATE INDEX idx_program_progress_user_id ON public.program_progress(user_id);
CREATE INDEX idx_tasks_user_id_date ON public.tasks(user_id, date);
CREATE INDEX idx_tasks_user_id_status ON public.tasks(user_id, status);
CREATE INDEX idx_meal_plan_user_id ON public.meal_plan(user_id);
CREATE INDEX idx_shopping_list_user_id ON public.shopping_list(user_id);
CREATE INDEX idx_family_data_user_id ON public.family_data(user_id);
CREATE INDEX idx_routines_user_id ON public.routines(user_id);
CREATE INDEX idx_planner_events_user_id_start ON public.planner_events(user_id, start_date);
CREATE INDEX idx_todo_list_user_id_status ON public.todo_list(user_id, status);
CREATE INDEX idx_todo_list_user_id_due_date ON public.todo_list(user_id, due_date);
CREATE INDEX idx_recipes_user_id_public ON public.recipes(user_id, is_public);
CREATE INDEX idx_recipes_category ON public.recipes(category);
CREATE INDEX idx_recipes_meal_type ON public.recipes(meal_type);

-- =============================================
-- TRIGGER POUR METTRE À JOUR updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger à toutes les tables
CREATE TRIGGER handle_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_program_progress_updated_at BEFORE UPDATE ON public.program_progress FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_meal_plan_updated_at BEFORE UPDATE ON public.meal_plan FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_shopping_list_updated_at BEFORE UPDATE ON public.shopping_list FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_family_data_updated_at BEFORE UPDATE ON public.family_data FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_routines_updated_at BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_planner_events_updated_at BEFORE UPDATE ON public.planner_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_todo_list_updated_at BEFORE UPDATE ON public.todo_list FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
