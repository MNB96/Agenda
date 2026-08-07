import { useMemo } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { differenceInCalendarDays, differenceInHours, format, isToday, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react-native'
import { SwipeableItemCard } from '../components/SwipeableItemCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useItems } from '../../application/items/useItems'
import { useSettings } from '../../application/settings/useSettings'
import { DEFAULT_CATEGORIES } from '../../domain/settings/types'
import {
  useTaskEntries,
  type TaskSectionKey,
  type LocalEntry,
  type GoogleEntry,
  type HolidayEntry,
} from '../../application/task/useTaskEntries'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { resolveCategoryIcon } from '../theme/categoryIcons'

const sectionLabel: Record<TaskSectionKey, string> = {
  overdue: 'Vencidas',
  next: 'Proximo',
  important: 'Importante',
  later: 'Sin fecha',
  completed: 'Completadas',
}

const resolveSectionColor = (bucket: TaskSectionKey, colors: ThemeTokens): string => {
  if (bucket === 'overdue') return colors.danger
  if (bucket === 'important') return colors.accent
  if (bucket === 'later') return colors.secondary
  if (bucket === 'completed') return colors.textMuted
  return colors.primary
}

const resolveCategoryChip = (categoryId: string, colors: ThemeTokens) => {
  if (categoryId === 'facultad' || categoryId === 'salud') {
    return { backgroundColor: colors.secondarySoft, borderColor: colors.secondary, textColor: colors.text }
  }
  if (categoryId === 'trabajo' || categoryId === 'compras') {
    return { backgroundColor: colors.creamSoft, borderColor: colors.cream, textColor: colors.text }
  }
  if (categoryId === 'casa') {
    return { backgroundColor: colors.primarySoft, borderColor: colors.primary, textColor: colors.text }
  }
  return { backgroundColor: '#FFFFFF', borderColor: colors.borderStrong, textColor: colors.textSecondary }
}

const resolveDarkChipText = (
  categoryId: 'all' | string,
  isActive: boolean,
  colors: ThemeTokens,
): string => {
  if (isActive) {
    return colors.onPrimary
  }
  if (categoryId === 'trabajo' || categoryId === 'compras') {
    return '#263238'
  }
  if (categoryId === 'facultad' || categoryId === 'salud') {
    return colors.secondary
  }
  if (categoryId === 'casa') {
    return colors.primarySoft
  }
  return colors.textSecondary
}

const formatOverdueDuration = (past: Date): string => {
  const now = new Date()
  const hours = differenceInHours(now, past)
  if (hours < 24) return hours <= 1 ? 'hace 1 hora' : `hace ${hours} horas`
  const days = differenceInCalendarDays(startOfDay(now), startOfDay(past))
  if (days === 1) return 'hace 1 día'
  if (days < 7) return `hace ${days} días`
  if (days < 14) return 'hace 1 semana'
  if (days < 21) return 'hace 2 semanas'
  if (days < 28) return 'hace 3 semanas'
  if (days < 60) return 'hace 1 mes'
  return `hace ${Math.floor(days / 30)} meses`
}

interface TaskScreenProps {
  onOpenItemEditor: (itemId: string) => void
}

export const TaskScreen = ({ onOpenItemEditor }: TaskScreenProps) => {
  const { toggleCompleted, removeItem } = useItems()
  const { data: settings } = useSettings()
  const { colors, isDark } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const {
    search,
    setSearch,
    activeCategory,
    setActiveCategory,
    sections,
    localItemsById,
    subtasksByParent,
    hasMoreCompleted,
    isLoadingMoreCompleted,
    loadMoreCompleted,
    isInitialLoading,
  } = useTaskEntries()

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar por titulo, categoria o ubicacion"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />

      <View style={styles.filtersWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        <Pressable onPress={() => setActiveCategory('all')} style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}>
          <Text
            style={[
              styles.filterChipText,
              isDark && { color: resolveDarkChipText('all', activeCategory === 'all', colors) },
              activeCategory === 'all' && styles.filterChipTextActive,
            ]}
          >
            Todo
          </Text>
        </Pressable>
        {DEFAULT_CATEGORIES.map((category) => {
          const isCategoryActive = activeCategory === category.id
          const chip = resolveCategoryChip(category.id, colors)
          const darkChipBackground =
            isDark
              ? category.id === 'personal'
                ? colors.surfaceSecondary
                : category.id === 'facultad' || category.id === 'salud'
                  ? 'rgba(167, 219, 216, 0.25)'
                  : category.id === 'trabajo' || category.id === 'compras'
                    ? 'rgba(224, 228, 204, 0.9)'
                    : 'rgba(105, 210, 231, 0.25)'
              : chip.backgroundColor

          const chipTextColor = isDark ? resolveDarkChipText(category.id, isCategoryActive, colors) : chip.textColor
          const CategoryIcon = resolveCategoryIcon(category.icon)

          return (
            <Pressable
              key={category.id}
              onPress={() => setActiveCategory(category.id)}
              style={[
                styles.filterChip,
                settings?.showCategoryIcons && { flexDirection: 'row', alignItems: 'center', gap: 6 },
                {
                  backgroundColor: darkChipBackground,
                  borderColor: isDark && category.id === 'personal' ? colors.borderStrong : chip.borderColor,
                },
                isCategoryActive && styles.filterChipActive,
              ]}
            >
              {settings?.showCategoryIcons && <CategoryIcon size={13} color={chipTextColor} />}
              <Text
                style={[
                  styles.filterChipText,
                  { color: chipTextColor },
                  isCategoryActive && styles.filterChipTextActive,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      </View>

      {isInitialLoading ? (
        <View style={styles.loadingState}>
          <LoadingSpinner size={120} />
        </View>
      ) : (
      <FlatList
        data={sections}
        keyExtractor={([bucket], index) => `section-${bucket}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <CalendarDays size={18} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Todo tranquilo por ahora</Text>
            <Text style={styles.emptySubtitle}>No tenes nada pendiente para hoy.</Text>
          </View>
        }
        renderItem={({ item: [bucket, entries] }) => {
          const label = (() => {
            if (bucket === 'overdue' || bucket === 'completed') {
              return sectionLabel[bucket]
            }
            const firstLocal = entries.find((entry): entry is LocalEntry => entry.kind === 'local')
            if (firstLocal) {
              const localItem = localItemsById.get(firstLocal.itemId)
              const dateStr = localItem?.startDate ?? localItem?.deadline
              if (dateStr) {
                const date = new Date(dateStr + 'T00:00:00')
                return isToday(date) ? 'HOY' : format(date, "d 'de' MMMM", { locale: es })
              }
              return 'Sin fecha'
            }
            const firstGoogle = entries.find((entry): entry is GoogleEntry => entry.kind === 'google')
            if (firstGoogle) return firstGoogle.subtitle
            const firstHoliday = entries.find((entry): entry is HolidayEntry => entry.kind === 'holiday')
            if (firstHoliday) return firstHoliday.subtitle
            return sectionLabel[bucket]
          })()
          return (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: resolveSectionColor(bucket, colors) }]}>{label}</Text>
            {entries.map((entry) => {
              if (entry.kind === 'local') {
                const localItem = localItemsById.get(entry.itemId)
                if (!localItem) {
                  return null
                }
                const overdueDeadlineLabel = (() => {
                  if (bucket !== 'overdue' || !localItem.deadline) return undefined
                  const deadlineMoment = new Date(localItem.deadline + 'T00:00:00')
                  const days = differenceInCalendarDays(startOfDay(new Date()), startOfDay(deadlineMoment))
                  return days > 0 ? `Venció ${formatOverdueDuration(deadlineMoment)}` : undefined
                })()
                // Vencidas solo miran startDate: el mismo día pasa a estar vencido en cuanto pasa su startTime, no recién al día siguiente.
                const overdueLabel = (() => {
                  if (bucket !== 'overdue' || !localItem.startDate) return undefined
                  const startMoment = localItem.startTime
                    ? new Date(`${localItem.startDate}T${localItem.startTime}:00`)
                    : new Date(`${localItem.startDate}T00:00:00`)
                  return startMoment < new Date() ? formatOverdueDuration(startMoment) : undefined
                })()
                return (
                  <SwipeableItemCard
                    key={localItem.id}
                    item={localItem}
                    overdueDeadlineLabel={overdueDeadlineLabel}
                    overdueLabel={overdueLabel}
                    subtasks={subtasksByParent.get(localItem.id)}
                    onToggle={async (item) => {
                      try {
                        await toggleCompleted(item)
                      } catch (error) {
                        Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá de nuevo.')
                      }
                    }}
                    onToggleSubtask={async (sub) => { await toggleCompleted(sub) }}
                    onOpen={() => onOpenItemEditor(localItem.id)}
                    onDelete={async (item) => {
                      try {
                        await removeItem(item)
                      } catch (error) {
                        Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Intentá de nuevo.')
                      }
                    }}
                    deleteConfirmTitle="Eliminar tarea"
                    deleteConfirmMessage="¿Eliminar esta tarea?"
                  />
                )
              }

              if (entry.kind === 'holiday') {
                return (
                  <View key={entry.id} style={styles.googleInlineRow}>
                    <View style={[styles.googleDot, { backgroundColor: entry.color }]} />
                    <View style={styles.googleInlineContent}>
                      <Text style={styles.googleCardTitle}>{entry.title}</Text>
                      <Text style={styles.googleCardMeta}>{entry.subtitle}</Text>
                      <Text style={[styles.holidayTypeLabel, { color: entry.color }]}>{entry.typeLabel}</Text>
                    </View>
                  </View>
                )
              }

              return (
                <View key={entry.id} style={styles.googleInlineRow}>
                  <View style={[styles.googleDot, { backgroundColor: entry.color }]} />
                  <View style={styles.googleInlineContent}>
                    <Text style={styles.googleCardTitle}>{entry.title}</Text>
                    <Text style={styles.googleCardMeta}>{entry.subtitle}</Text>
                    {entry.secondary ? <Text style={styles.googleCardMeta}>{entry.secondary}</Text> : null}
                  </View>
                </View>
              )
            })}
            {bucket === 'completed' && hasMoreCompleted ? (
              <Pressable
                style={styles.loadMoreButton}
                disabled={isLoadingMoreCompleted}
                onPress={loadMoreCompleted}
              >
                {isLoadingMoreCompleted ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Cargar más completadas</Text>
                )}
              </Pressable>
            ) : null}
          </View>
          )
        }}
      />
      )}
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 12,
      color: colors.text,
      fontSize: 16,
    },
    filtersWrapper: {
      marginBottom: 14,
      paddingVertical: 4,
    },
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      paddingRight: 12,
    },
    filterChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      minHeight: 36,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 0,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.textSecondary },
    filterChipTextActive: { color: '#FFFFFF', fontWeight: '800' },
    section: { marginBottom: 10 },
    sectionTitle: {
      fontSize: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 3,
      fontWeight: '800',
    },
    listContent: {
      paddingBottom: 104,
      minHeight: '78%',
    },
    googleInlineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
    },
    googleInlineContent: { flex: 1 },
    googleDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      marginTop: 5,
    },
    googleCardTitle: { fontSize: 17, fontWeight: '500', color: colors.text },
    googleCardMeta: { fontSize: 14, color: colors.textSecondary, marginTop: 3 },
    holidayTypeLabel: { fontSize: 12, fontWeight: '700', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 72,
      paddingHorizontal: 28,
    },
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
    emptySubtitle: { color: colors.textSecondary, fontSize: 15, marginTop: 4, textAlign: 'center' },
    loadMoreButton: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 4,
    },
    loadMoreText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
  })
