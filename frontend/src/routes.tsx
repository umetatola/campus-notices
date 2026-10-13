import type { RouteObject } from 'react-router'
import Layout from './pages/Layout'
import NoticeListPage from './pages/NoticeListPage'
import NoticeDetailPage from './pages/NoticeDetailPage'
import NotFoundPage from './pages/NotFoundPage'
import SignInPage from './pages/SignInPage'
import VerifyPage from './pages/VerifyPage'
import AlertsPage from './pages/AlertsPage'
import UnsubscribePage from './pages/UnsubscribePage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <NoticeListPage /> },
      { path: '/notices/:id', element: <NoticeDetailPage /> },
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/auth/verify', element: <VerifyPage /> },
      { path: '/alerts', element: <AlertsPage /> },
      { path: '/unsubscribe', element: <UnsubscribePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
