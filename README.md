# Agenda Personal (React Native)

Aplicacion mobile-first en React Native (Expo) para organizar la vida diaria con una unica lista y dos pantallas principales: Hoy y Agenda.

## Stack

- React Native + Expo + TypeScript
- React Navigation (tabs)
- Zustand
- TanStack Query
- date-fns
- lucide-react-native
- AsyncStorage (persistencia local desacoplada)
- Google Calendar API (OAuth)

## Estado actual del MVP mobile

- Navegacion principal de 2 tabs: Hoy y Agenda
- Alta rapida con parser local (texto natural basico)
- Una sola coleccion de items (task/event/deadline/date_window/goal)
- Filtros por categoria y busqueda simple en Hoy
- Vista Agenda cronologica por fecha con eventos locales + Google Calendar
- Edicion de item y sincronizacion opcional con Google Calendar
- Ajustes (Google, recordatorios, licencias por examen)
- Persistencia local en AsyncStorage con repositorios

## Arquitectura

- src/domain: modelos e interfaces
- src/repositories/asyncstorage: persistencia local
- src/providers: integraciones (calendar)
- src/services: parser, scoring y utilidades de negocio
- src/features: hooks de casos de uso
- src/mobile: UI React Native (screens, modals, navigation)
- src/state: estado global de sesion/UI

## Variables de entorno

Copiar .env.example a .env y completar:

- EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID
- EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
- EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
- EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

## Google Calendar OAuth en mobile

1. Crear proyecto en Google Cloud.
2. Habilitar Google Calendar API.
3. Configurar OAuth consent screen.
4. Crear credenciales OAuth para Android/iOS (y Expo/Web si aplica al flujo de pruebas).
5. Cargar client IDs en variables EXPO_PUBLIC.

La app detecta token expirado/no autorizado y solicita reconexion.

En web, conectar Google requiere EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Si falta, el boton de conexion queda deshabilitado para evitar errores en runtime.

## Ejecucion

```bash
npm install
npm run start
```

Atajos:

- Android: npm run android
- iOS: npm run ios

## Sobre Babel

`babel.config.js` se mantiene porque Expo/Metro usa Babel para transformar React Native. Este archivo esta en su forma minima (`babel-preset-expo`) y no agrega complejidad extra.

## Nota de producto

El foco ahora es app de celular. La vieja capa web (Vite/React Router) quedo fuera del flujo principal de ejecucion.
