import { Outlet } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'

const POINTS = [
  'Check content against your approved brand guidelines before it is published.',
  'Keep terminology, facts and messaging consistent across every team.',
  'Humans stay in control of every final approval.',
]

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Logo inverted />
        <div className="space-y-8">
          <p className="text-4xl font-semibold leading-tight">
            One Brand.
            <br />
            Every Voice.
            <br />
            Zero Compromise.
          </p>
          <ul className="max-w-md list-disc space-y-3 pl-5 text-base">
            {POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm">BrandGuard AI brand governance platform</p>
      </aside>
      <main className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
