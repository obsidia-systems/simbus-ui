import { create } from 'zustand'

interface WizardState {
  step: 1 | 2 | 3
  presetId: string | null
  yaml: string
  name: string
  tickInterval: number
  seed: string
  hostModbusPort: string
  set: (patch: Partial<Omit<WizardState, 'set' | 'reset'>>) => void
  reset: () => void
}

const initial = {
  step: 1 as const,
  presetId: null as string | null,
  yaml: '',
  name: '',
  tickInterval: 1,
  seed: '',
  hostModbusPort: '',
}

export const useWizard = create<WizardState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set(initial),
}))
