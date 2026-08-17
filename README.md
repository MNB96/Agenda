# Agenda Personal — React Native (Expo)

App de productividad personal mobile-first. Nombre de display: **Tasks**. Package: `com.agenda.personal`.

## Tabs

| Tab | Descripción |
|---|---|
| **Tareas** | Lista de tareas con secciones (vencidas, hoy, importante, sin fecha, completadas), búsqueda, filtros por categoría y swipe gestures |
| **Facultad** | Seguimiento académico: exámenes, materias, ausencias, licencias por examen |
| **Metas** | Metas con deadline, sub-metas, sync con Google Tasks |
| **Hábitos** | Rastreador con streaks, multi-repetición diaria, estadísticas |

## Stack

- React Native 0.86 + Expo 57 + TypeScript (strict)
- Hermes runtime en Android
- React Navigation v7 (bottom tabs)
- TanStack React Query v5 + Zustand v5
- expo-sqlite (base de datos principal)
- AsyncStorage (settings y flags de migración)
- Google Calendar API + Google Tasks API + Google Sign-In
- expo-notifications (notificaciones locales con acciones)
- expo-location (tiempo de viaje)
- date-fns v4 (locale español)

## Arquitectura

Capas limpias estrictas:

```
domain/         ← Entidades, interfaces, servicios puros (sin React, sin infra)
infrastructure/ ← SQLite, AsyncStorage, Google APIs, Notifications
application/    ← Hooks React Query (casos de uso)
mobile/         ← UI React Native (screens, modals, components, theme)
state/          ← Zustand (solo sesión Google OAuth)
app/            ← container.ts: único punto de DI
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

## Ejecución

```bash
npm install
npm run android    # debug en emulador o dispositivo
npm run start      # Metro bundler (Expo Go)
```

## Build release Android

```bash
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

## Google OAuth — setup

1. Crear proyecto en Google Cloud Console
2. Habilitar Google Calendar API y Google Tasks API
3. Configurar OAuth consent screen
4. Crear credenciales OAuth para Android e iOS
5. Cargar IDs en las variables `EXPO_PUBLIC_GOOGLE_*`

La app detecta token expirado/no autorizado y solicita reconexión silenciosa o interactiva.

## Babel

`babel.config.js` usa `babel-preset-expo` con `allowDeclareFields: true` (requerido para el patrón de tipado nominal en entidades de dominio).

## Docs de features

Ver `docs/` para documentación detallada de cada pantalla.  
Ver `CLAUDE.md` para la guía técnica completa del proyecto.
