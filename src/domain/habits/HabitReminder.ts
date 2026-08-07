export const HABIT_REMINDER_MODE = {
  INTERVAL: 'interval',
  RANDOM: 'random',
} as const

export type HabitReminderMode = (typeof HABIT_REMINDER_MODE)[keyof typeof HABIT_REMINDER_MODE]

export interface HabitReminderConfig {
  mode: HabitReminderMode
  /** Hours between notifications — required when mode is 'interval'. */
  intervalHours?: number
  /** Notifications per day — required when mode is 'random'. */
  timesPerDay?: number
  /** 'HH:mm', optional on both modes — an omitted window defaults to the full day. */
  windowStart?: string
  /** 'HH:mm', optional on both modes — an omitted window defaults to the full day. */
  windowEnd?: string
  /** Rolled once (not derived) so it stays fixed across days — see generateRandomTimes. */
  randomTimes?: readonly string[]
}

const isValidTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// New input only, same as Item's other validators — a persisted row just gets read back as-is.
export const validateHabitReminder = (reminder: HabitReminderConfig): void => {
  if (reminder.mode === HABIT_REMINDER_MODE.INTERVAL) {
    if (!reminder.intervalHours || reminder.intervalHours <= 0) {
      throw new Error('El intervalo debe ser mayor a 0 horas.')
    }
  } else if (reminder.mode === HABIT_REMINDER_MODE.RANDOM) {
    if (!reminder.timesPerDay || reminder.timesPerDay < 1) {
      throw new Error('Elegí al menos 1 vez al día.')
    }
    if (!reminder.randomTimes?.length) {
      throw new Error('Faltan los horarios sorteados.')
    }
  } else {
    throw new Error(`Modo de recordatorio desconocido: "${reminder.mode}".`)
  }

  if (reminder.windowStart && !isValidTime(reminder.windowStart)) {
    throw new Error('Horario de inicio de ventana inválido.')
  }
  if (reminder.windowEnd && !isValidTime(reminder.windowEnd)) {
    throw new Error('Horario de fin de ventana inválido.')
  }
  if (reminder.windowStart && reminder.windowEnd && reminder.windowStart >= reminder.windowEnd) {
    throw new Error('La ventana horaria debe empezar antes de terminar.')
  }
}
