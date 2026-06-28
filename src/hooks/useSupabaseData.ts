'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

// Types pour les données Supabase
interface ProgramProgress {
  id: string
  user_id: string
  current_day: number
  start_date: string
  last_access_date: string
  completed_missions: number
  mission_responses: any[]
  created_at: string
  updated_at: string
}

interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  category: 'self' | 'family' | 'pro' | 'social'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  date?: string
  start_hour?: number
  duration_hours: number
  color: string
  completed_at?: string
  created_at: string
  updated_at: string
}

interface MealPlan {
  id: string
  user_id: string
  day_of_week: string
  meal_type: 'lunch' | 'dinner'
  recipe_id?: string
  custom_meal?: string
  created_at: string
  updated_at: string
}

interface Recipe {
  id: string
  user_id?: string
  title: string
  description?: string
  prep_time?: string
  cook_time?: string
  total_time?: string
  category?: string
  meal_type?: string
  ingredients: string[]
  steps: string[]
  calories?: number
  proteins?: number
  carbs?: number
  fats?: number
  is_public: boolean
  is_favorite: boolean
  difficulty?: string
  servings: number
  created_at: string
  updated_at: string
}

interface ShoppingListItem {
  id: string
  user_id: string
  ingredient: string
  quantity?: string
  category?: string
  checked: boolean
  in_stock: boolean
  to_buy: boolean
  recipe_id?: string
  created_at: string
  updated_at: string
}

interface FamilyData {
  id: string
  user_id: string
  data_type: 'member' | 'contact' | 'emergency_contact' | 'preference'
  data: any
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Routine {
  id: string
  user_id: string
  title: string
  description?: string
  frequency: 'daily' | 'weekly' | 'monthly'
  category: string
  completed: boolean
  last_completed_at?: string
  preferred_time?: string
  created_at: string
  updated_at: string
}

// Hook pour la progression du programme
export function useProgramProgress(user: User | null) {
  const [progress, setProgress] = useState<ProgramProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProgress(null)
      setLoading(false)
      return
    }

    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('program_progress')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
          console.error('Error fetching program progress:', error)
        } else {
          setProgress(data)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProgress()
  }, [user])

  const updateProgress = async (updates: Partial<ProgramProgress>) => {
    if (!user || !progress) return null

    try {
      const { data, error } = await supabase
        .from('program_progress')
        .update({
          ...updates,
          last_access_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating program progress:', error)
        return null
      }

      setProgress(data)
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  const createProgress = async (initialData: Partial<ProgramProgress>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('program_progress')
        .insert({
          user_id: user.id,
          ...initialData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating program progress:', error)
        return null
      }

      setProgress(data)
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  return {
    progress,
    loading,
    updateProgress,
    createProgress
  }
}

// Hook pour les tâches
export function useTasks(user: User | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true })

        if (error) {
          console.error('Error fetching tasks:', error)
        } else {
          setTasks(data || [])
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [user])

  const addTask = async (taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          ...taskData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding task:', error)
        return null
      }

      setTasks(prev => [...prev, data])
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating task:', error)
        return null
      }

      setTasks(prev => prev.map(task => task.id === taskId ? data : task))
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting task:', error)
        return false
      }

      setTasks(prev => prev.filter(task => task.id !== taskId))
      return true
    } catch (error) {
      console.error('Error:', error)
      return false
    }
  }

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask
  }
}

// Hook pour les recettes
export function useRecipes(user: User | null) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        let query = supabase
          .from('recipes')
          .select('*')

        // Si utilisateur connecté, récupérer ses recettes + les recettes publiques
        if (user) {
          query = query.or(`user_id.eq.${user.id},is_public.eq.true`)
        } else {
          // Si non connecté, uniquement les recettes publiques
          query = query.eq('is_public', true)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching recipes:', error)
        } else {
          setRecipes(data || [])
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecipes()
  }, [user])

  const addRecipe = async (recipeData: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          user_id: user.id,
          ...recipeData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding recipe:', error)
        return null
      }

      setRecipes(prev => [data, ...prev])
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  const updateRecipe = async (recipeId: string, updates: Partial<Recipe>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('recipes')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', recipeId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating recipe:', error)
        return null
      }

      setRecipes(prev => prev.map(recipe => recipe.id === recipeId ? data : recipe))
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  return {
    recipes,
    loading,
    addRecipe,
    updateRecipe
  }
}

// Hook pour les listes de courses
export function useShoppingList(user: User | null) {
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setShoppingList([])
      setLoading(false)
      return
    }

    const fetchShoppingList = async () => {
      try {
        const { data, error } = await supabase
          .from('shopping_list')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error fetching shopping list:', error)
        } else {
          setShoppingList(data || [])
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchShoppingList()
  }, [user])

  const addItem = async (itemData: Omit<ShoppingListItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('shopping_list')
        .insert({
          user_id: user.id,
          ...itemData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding shopping item:', error)
        return null
      }

      setShoppingList(prev => [...prev, data])
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  const updateItem = async (itemId: string, updates: Partial<ShoppingListItem>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('shopping_list')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating shopping item:', error)
        return null
      }

      setShoppingList(prev => prev.map(item => item.id === itemId ? data : item))
      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting shopping item:', error)
        return false
      }

      setShoppingList(prev => prev.filter(item => item.id !== itemId))
      return true
    } catch (error) {
      console.error('Error:', error)
      return false
    }
  }

  return {
    shoppingList,
    loading,
    addItem,
    updateItem,
    deleteItem
  }
}
