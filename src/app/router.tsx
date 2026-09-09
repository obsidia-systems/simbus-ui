import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'

import { Shell } from '@/app/layout/Shell'
import { DevicePage } from '@/app/pages/DevicePage'
import { PresetsPage } from '@/app/pages/PresetsPage'
import { SitePage } from '@/app/pages/SitePage'
import { WizardPage } from '@/app/pages/WizardPage'

const rootRoute = createRootRoute({
  component: Shell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SitePage,
})

const presetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/presets',
  component: PresetsPage,
})

const wizardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/devices/new',
  component: WizardPage,
})

const deviceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/devices/$deviceId',
  component: DevicePage,
})

const routeTree = rootRoute.addChildren([indexRoute, presetsRoute, wizardRoute, deviceRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />
}
