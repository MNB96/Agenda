import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import { useEffect } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useGoogleCalendars } from '../../features/calendar/useGoogleCalendar'
import { useLicenseUsages, useSettings } from '../../features/settings/useSettings'
import { useGoogleAuthStore } from '../../state/googleAuthStore'

WebBrowser.maybeCompleteAuthSession()

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const { data: settings, saveSettings } = useSettings()
  const { data: usages } = useLicenseUsages()
  const { accessToken, connectedEmail, authIssue, setSession, clearSession } = useGoogleAuthStore()
  const calendarsQuery = useGoogleCalendars()

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  const nativeClientId =
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  const isWeb = Platform.OS === 'web'
  const canUseGoogleAuth = isWeb ? Boolean(webClientId) : Boolean(nativeClientId)

  const [request, response, promptAsync] = Google.useAuthRequest({
    responseType: 'token',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientId: nativeClientId ?? 'missing-native-client-id',
    webClientId: webClientId ?? 'missing-web-client-id',
  })

  useEffect(() => {
    if (response?.type !== 'success') {
      return
    }

    const token = response.authentication?.accessToken
    if (!token) {
      return
    }

    setSession({
      accessToken: token,
      expiresIn: response.authentication?.expiresIn ?? 3600,
    })
  }, [response, setSession])

  if (!settings) {
    return null
  }

  const totalUsedDays = (usages ?? []).reduce((acc, usage) => acc + usage.days, 0)
  const remaining = settings.availableExamLeaveDaysPerYear - totalUsedDays

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Ajustes</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Google Calendar</Text>
              <Text style={styles.metaText}>
                {accessToken ? `Conectado${connectedEmail ? `: ${connectedEmail}` : ''}` : 'No conectado'}
              </Text>
              {authIssue ? <Text style={styles.warnText}>La sesion necesita reconexion: {authIssue}</Text> : null}
              {!canUseGoogleAuth ? (
                <Text style={styles.warnText}>
                  {isWeb
                    ? 'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID para conectar Google en web.'
                    : 'Falta configurar un Client ID de Google para esta plataforma.'}
                </Text>
              ) : null}
              <View style={styles.actionsRow}>
                <Pressable
                  disabled={!request || !canUseGoogleAuth}
                  onPress={() => void promptAsync()}
                  style={[styles.primaryButton, (!request || !canUseGoogleAuth) && styles.disabled]}
                >
                  <Text style={styles.primaryButtonText}>{accessToken ? 'Reconectar' : 'Conectar'}</Text>
                </Pressable>
                <Pressable onPress={clearSession} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Desconectar</Text>
                </Pressable>
              </View>
              {(calendarsQuery.data ?? []).map((calendar) => (
                <Pressable
                  key={calendar.id}
                  onPress={() => {
                    const selected = settings.selectedGoogleCalendarIds.includes(calendar.id)
                    const next = selected
                      ? settings.selectedGoogleCalendarIds.filter((entry) => entry !== calendar.id)
                      : [...settings.selectedGoogleCalendarIds, calendar.id]
                    void saveSettings({ ...settings, selectedGoogleCalendarIds: next })
                  }}
                  style={styles.calendarOption}
                >
                  <Text style={styles.calendarOptionText}>
                    {settings.selectedGoogleCalendarIds.includes(calendar.id) ? '✓' : '○'} {calendar.summary}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recordatorios</Text>
              <View style={styles.switchRow}>
                <Text style={styles.metaText}>Activar recordatorios</Text>
                <Switch
                  value={settings.remindersEnabled}
                  onValueChange={(value) => void saveSettings({ ...settings, remindersEnabled: value })}
                />
              </View>
              <TextInput
                value={String(settings.defaultReminderMinutes)}
                onChangeText={(value) =>
                  void saveSettings({ ...settings, defaultReminderMinutes: Number(value) || 0 })
                }
                keyboardType="numeric"
                style={styles.input}
                placeholder="Minutos antes"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Licencias por examen</Text>
              <Text style={styles.metaText}>
                Usadas: {totalUsedDays} · Disponibles: {settings.availableExamLeaveDaysPerYear} · Restantes: {remaining}
              </Text>
              <TextInput
                value={String(settings.availableExamLeaveDaysPerYear)}
                onChangeText={(value) =>
                  void saveSettings({ ...settings, availableExamLeaveDaysPerYear: Number(value) || 0 })
                }
                keyboardType="numeric"
                style={styles.input}
                placeholder="Dias disponibles por ano"
              />
            </View>
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 10,
  },
  section: {
    borderWidth: 1,
    borderColor: '#e7ddd0',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#292524', marginBottom: 4 },
  metaText: { color: '#57534e', fontSize: 12 },
  warnText: { color: '#be123c', fontSize: 12, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryButton: {
    backgroundColor: '#9a3412',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#e7ddd0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonText: { color: '#57534e', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  calendarOption: { marginTop: 6 },
  calendarOptionText: { color: '#44403c', fontSize: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#e7ddd0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  closeButton: {
    backgroundColor: '#292524',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  closeButtonText: { color: '#fff', fontWeight: '700' },
})
