import type { ReactNode } from 'react'
import DotField from '@/components/kokonutui/dot-field'

/**
 * 认证页外壳：Dot Field 交互背景 + 居中品牌卡片。
 */
export default function AuthShell({
  subtitle,
  children,
}: {
  subtitle: string
  children: ReactNode
}) {
  return (
    <DotField className="min-h-screen" interactive seed={7}>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[400px] rounded-xl border border-border/80 bg-card/85 p-9 shadow-xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <h1 className="font-heading text-[34px] font-semibold tracking-[0.16em] text-foreground">
              FEMINA<span className="text-primary">.</span>
            </h1>
            <div className="mx-auto mb-3 mt-4 h-0.5 w-9 bg-primary" />
            <p className="text-[13px] tracking-[0.08em] text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </DotField>
  )
}
