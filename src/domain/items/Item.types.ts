export type RepeatRule = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export type ItemStatus = 'active' | 'completed'

export interface ItemCategory {
  id: string
  name: string
  color: string
  icon: string
}
