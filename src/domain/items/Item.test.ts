import { describe, expect, it } from 'vitest'
import { Item } from './Item'

describe('Item reminderOnly', () => {
  it('persists the reminder-only flag on creation', () => {
    const item = Item.create({
      title: 'Recordatorio de pago',
      reminderOnly: true,
      startDate: '2026-08-13',
    })

    expect(item.reminderOnly).toBe(true)
  })
})
