import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { useEffect, useMemo } from 'react'
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useGoogleCalendars } from '../../application/calendar/useGoogleCalendar'
import { useSettings } from '../../application/settings/useSettings'
import { useItems } from '../../application/items/useItems'
import { useGoogleAuthStore, GOOGLE_TOKEN_TTL_SECONDS } from '../../state/googleAuthStore'
import { openNotificationSoundSettings, openExactAlarmSettings } from '../../infrastructure/notifications/itemNotifications'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

WebBrowser.maybeCompleteAuthSession()

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const { data: settings, saveSettings } = useSettings()
  const { items, removeItem } = useItems()
  const { accessToken, connectedEmail, authIssue, setSession, clearSession } = useGoogleAuthStore()
  const calendarsQuery = useGoogleCalendars()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  const nativeClientId =
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  const isWeb = Platform.OS === 'web'
  // Native uses the on-device Google Sign-In SDK (Play Services), which validates the app by
  // package name + signing fingerprint instead of a redirect URI — Google no longer allows the
  // custom-scheme browser redirect for Android OAuth clients created after mid-2022, which is
  // what kept causing redirect_uri_mismatch / "Custom URI scheme is not enabled" errors.
  const canUseGoogleAuth = isWeb ? Boolean(webClientId) : true
  const isConnected = Boolean(accessToken) && !authIssue
  const hasSessionToDisconnect = Boolean(accessToken || connectedEmail || authIssue)

  const [request, response, promptAsync] = Google.useAuthRequest({
    responseType: 'token',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientId: nativeClientId ?? 'missing-native-client-id',
    webClientId: webClientId ?? 'missing-web-client-id',
  })

  useEffect(() => {
    if (!isWeb) return
    if (response?.type !== 'success') {
      return
    }

    const token = response.authentication?.accessToken
    if (!token) {
      return
    }

    setSession({
      accessToken: token,
      expiresIn: response.authentication?.expiresIn ?? GOOGLE_TOKEN_TTL_SECONDS,
    })
  }, [isWeb, response, setSession])

  useEffect(() => {
    if (isWeb) return
    GoogleSignin.configure({ scopes: ['https://www.googleapis.com/auth/calendar'] })
    // Actual silent-refresh (on mount + periodically before the token expires) lives in
    // useGoogleSessionLifecycleMobile, which runs for the whole app lifetime — doing it
    // here too would just race it.
  }, [isWeb])

  const handleConnect = async () => {
    if (isWeb) {
      void promptAsync()
      return
    }
    try {
      GoogleSignin.configure({ scopes: ['https://www.googleapis.com/auth/calendar'] })
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

      // "Reconectar" casi siempre es refrescar una sesión que Play Services ya conoce —
      // probar en silencio primero evita abrir el selector de cuenta, que es lo que hace
      // que el modal de Ajustes se cierre solo en algunos dispositivos al cambiar de
      // Activity y volver.
      if (GoogleSignin.hasPreviousSignIn()) {
        try {
          const silent = await GoogleSignin.signInSilently()
          if (silent.type === 'success') {
            const tokens = await GoogleSignin.getTokens()
            setSession({
              accessToken: tokens.accessToken,
              expiresIn: GOOGLE_TOKEN_TTL_SECONDS,
              connectedEmail: silent.data.user.email,
            })
            return
          }
        } catch {
          // Sigue al flujo interactivo.
        }
      }

      const result = await GoogleSignin.signIn()
      if (result.type !== 'success') return
      const tokens = await GoogleSignin.getTokens()
      setSession({
        accessToken: tokens.accessToken,
        expiresIn: GOOGLE_TOKEN_TTL_SECONDS,
        connectedEmail: result.data.user.email,
      })
    } catch (error) {
      console.error('[GoogleSignin] connect failed', error)
      Alert.alert('No se pudo conectar', 'No se pudo conectar con Google Calendar. Probá de nuevo en unos segundos.')
    }
  }

  const handleDisconnect = () => {
    if (!isWeb) {
      void GoogleSignin.signOut()
    }
    clearSession()
  }

  if (!settings) {
    return null
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation?.()}>
          <Text style={styles.title}>Ajustes</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tema</Text>
              <View style={styles.themeRow}>
                {(['system', 'light', 'dark'] as const).map((mode) => {
                  const active = settings.themePreference === mode
                  const label = mode === 'system' ? 'Sistema' : mode === 'light' ? 'Claro' : 'Oscuro'

                  return (
                    <Pressable
                      key={mode}
                      onPress={() => void saveSettings({ ...settings, themePreference: mode })}
                      style={[
                        styles.themeOption,
                        active &&
                          (mode === 'light'
                            ? styles.themeOptionLight
                            : mode === 'dark'
                              ? styles.themeOptionDark
                              : styles.themeOptionSystem),
                      ]}
                    >
                      <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Google Calendar</Text>
              <Text style={styles.metaText}>
                {accessToken ? `Conectado${connectedEmail ? `: ${connectedEmail}` : ''}` : 'No conectado'}
              </Text>
              {authIssue ? <Text style={styles.warnText}>La sesion necesita reconexion: {authIssue}</Text> : null}
              {!canUseGoogleAuth ? (
                <Text style={styles.warnText}>
                  Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID para conectar Google en web.
                </Text>
              ) : null}
              <View style={styles.actionsRow}>
                {/* Conectado y sano: no hay nada que "conectar" de nuevo, solo desconectar.
                    authIssue (no accessToken) es la señal real de que hace falta reconectar —
                    accessToken solo no lo distingue de "recién arrancó, nunca se conectó". */}
                {!isConnected && (
                  <Pressable
                    disabled={isWeb && (!request || !canUseGoogleAuth)}
                    onPress={() => void handleConnect()}
                    style={[styles.primaryButton, isWeb && (!request || !canUseGoogleAuth) && styles.disabled]}
                  >
                    <Text style={styles.primaryButtonText}>{authIssue ? 'Reconectar' : 'Conectar'}</Text>
                  </Pressable>
                )}
                {hasSessionToDisconnect && (
                  <Pressable onPress={handleDisconnect} style={isConnected ? styles.dangerButton : styles.secondaryButton}>
                    <Text style={isConnected ? styles.dangerButtonText : styles.secondaryButtonText}>Desconectar</Text>
                  </Pressable>
                )}
              </View>
              {(calendarsQuery.data ?? []).map((calendar) => (
                <Pressable
                  key={calendar.id}
                  onPress={() => {
                    const selected = settings.selectedCalendarIds.includes(calendar.id)
                    const next = selected
                      ? settings.selectedCalendarIds.filter((entry) => entry !== calendar.id)
                      : [...settings.selectedCalendarIds, calendar.id]
                    void saveSettings({ ...settings, selectedCalendarIds: next })
                  }}
                  style={styles.calendarOption}
                >
                  <Text style={styles.calendarOptionText}>
                    {settings.selectedCalendarIds.includes(calendar.id) ? '✓' : '○'} {calendar.summary}
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
              {Platform.OS === 'android' ? (
                <>
                  <Pressable style={[styles.secondaryButton, { marginTop: 8 }]} onPress={() => void openExactAlarmSettings()}>
                    <Text style={styles.secondaryButtonText}>Permitir alarmas exactas</Text>
                  </Pressable>
                  <Text style={[styles.metaText, { marginTop: 6 }]}>
                    Sin este permiso, Android puede demorar o no disparar los recordatorios a la hora exacta.
                  </Text>
                  <Pressable style={[styles.secondaryButton, { marginTop: 8 }]} onPress={() => void openNotificationSoundSettings()}>
                    <Text style={styles.secondaryButtonText}>Sonido de notificaciones</Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Licencias por examen</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  value={String(settings.availableExamLeaveDaysPerYear)}
                  onChangeText={(value) =>
                    void saveSettings({ ...settings, availableExamLeaveDaysPerYear: Math.max(0, Number(value) || 0) })
                  }
                  keyboardType="numeric"
                  style={[styles.input, { width: 60 }]}
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.metaText}>días disponibles por año</Text>
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Datos</Text>
              {(() => {
                const completedCount = items.filter(item => item.status === 'completed').length
                return (
                  <Pressable
                    style={[styles.dangerButton, completedCount === 0 && styles.disabled]}
                    disabled={completedCount === 0}
                    onPress={() => {
                      Alert.alert(
                        'Borrar completadas',
                        `¿Borrar las ${completedCount} tareas completadas? Esta acción no se puede deshacer.`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Borrar',
                            style: 'destructive',
                            onPress: async () => {
                              const completed = items.filter(item => item.status === 'completed')
                              for (const item of completed) {
                                await removeItem(item)
                              }
                            },
                          },
                        ],
                      )
                    }}
                  >
                    <Text style={styles.dangerButtonText}>
                      Borrar completadas{completedCount > 0 ? ` (${completedCount})` : ''}
                    </Text>
                  </Pressable>
                )
              })()}
            </View>
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors: ThemeTokens) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayAccent,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  metaText: { color: colors.textSecondary, fontSize: 12 },
  warnText: { color: colors.danger, fontSize: 12, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  themeRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  themeOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  themeOptionSystem: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  themeOptionLight: { backgroundColor: colors.secondarySoft, borderColor: colors.secondary },
  themeOptionDark: { backgroundColor: colors.creamSoft, borderColor: colors.cream },
  themeOptionText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  themeOptionTextActive: { color: colors.onPrimary },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryButtonText: { color: colors.fabText, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  dangerButton: {
    backgroundColor: colors.danger + '18',
    borderWidth: 1,
    borderColor: colors.danger + '55',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  calendarOption: { marginTop: 6 },
  calendarOptionText: { color: colors.textSecondary, fontSize: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  closeButton: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonText: { color: colors.text, fontWeight: '700' },
})
