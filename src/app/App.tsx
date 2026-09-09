import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/app/query'
import { AppRouter } from '@/app/router'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  )
}
