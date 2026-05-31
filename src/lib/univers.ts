// src/lib/univers.ts
// Identité visuelle de chaque univers NOVAÉ : une couleur pastel signature,
// reprise dans la nav, les tuiles d'accueil, puis l'ambiance de chaque page.
import type { LucideIcon } from 'lucide-react'
import {
  Sun, Calendar, Target, Zap, BarChart2,
  MessageSquare, Bot, ShoppingCart, Users, FileText, Lightbulb,
} from 'lucide-react'

export const BEIGE = '#F8F1E5'        // fond global beige clair
export const ENCRE = '#3D2618'        // texte principal (brun NOVAÉ)
export const ENCRE_DOUCE = '#6B5B4E'  // texte secondaire / inactif

export interface Univers {
  key: string
  href: string
  label: string   // libellé complet
  short: string   // libellé court (nav)
  icon: LucideIcon
  color: string   // pastel signature (fond de tuile / pastille active)
  ink: string     // version soutenue (icône + accents)
}

export const UNIVERS: Univers[] = [
  { key: 'routines',  href: '/routines',  label: 'Routines',   short: 'Routines', icon: Sun,           color: '#F5D89B', ink: '#C79A3A' },
  { key: 'planner',   href: '/planner',   label: 'Planner',    short: 'Planner',  icon: Calendar,      color: '#C2D7E8', ink: '#5E8AAE' },
  { key: 'program',   href: '/program',   label: 'Programme',  short: 'Prog.',    icon: Target,        color: '#F3CDB6', ink: '#C77E52' },
  { key: 'defis',     href: '/defis',     label: 'Défis',      short: 'Défis',    icon: Zap,           color: '#F4B49E', ink: '#D17048' },
  { key: 'tracker',   href: '/tracker',   label: 'Tracker',    short: 'Tracker',  icon: BarChart2,     color: '#C5D3B4', ink: '#7E9460' },
  { key: 'community', href: '/community', label: 'Communauté', short: 'Commu.',   icon: MessageSquare, color: '#EFC6CC', ink: '#C77B88' },
  { key: 'agent',     href: '/agent',     label: 'IA',         short: 'IA',       icon: Bot,           color: '#D4C4E2', ink: '#8A6FB0' },
  { key: 'recipes',   href: '/recipes',   label: 'Repas',      short: 'Repas',    icon: ShoppingCart,  color: '#F2C2B6', ink: '#C97A66' },
  { key: 'family',    href: '/family',    label: 'Famille',    short: 'Famille',  icon: Users,         color: '#B9D7CB', ink: '#5E9A82' },
  { key: 'notes',     href: '/notes',     label: 'Notes',      short: 'Notes',    icon: FileText,      color: '#E9D8C0', ink: '#9C7C4E' },
  { key: 'astuces',   href: '/astuces',   label: 'Astuces',    short: 'Astuces',  icon: Lightbulb,     color: '#F4E2A2', ink: '#B89A2E' },
]

// Trouve l'univers d'un chemin (ex: '/family' ou '/program/14')
export function universForPath(pathname: string | null): Univers | undefined {
  if (!pathname) return undefined
  return UNIVERS.find(u => pathname === u.href || pathname.startsWith(u.href + '/'))
}