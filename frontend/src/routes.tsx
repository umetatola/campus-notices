import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import Layout from './pages/Layout'
import NoticeListPage from './pages/NoticeListPage'

// The notice list is the landing page and ships with the first load; every other page (and DOMPurify, which
// only the notice page needs) is fetched when it is first opened.
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <NoticeListPage /> },
      { path: '/notices/:id', lazy: page(() => import('./pages/NoticeDetailPage')) },
      { path: '/deadlines', lazy: page(() => import('./pages/DeadlinesPage')) },
      { path: '/sign-in', lazy: page(() => import('./pages/SignInPage')) },
      { path: '/auth/verify', lazy: page(() => import('./pages/VerifyPage')) },
      { path: '/alerts', lazy: page(() => import('./pages/AlertsPage')) },
      { path: '/saved', lazy: page(() => import('./pages/SavedPage')) },
      { path: '/unsubscribe', lazy: page(() => import('./pages/UnsubscribePage')) },
      { path: '*', lazy: page(() => import('./pages/NotFoundPage')) },
    ],
  },
]
