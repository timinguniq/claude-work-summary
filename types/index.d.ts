export type WorkSummary = {
  turnId: string
  prompt: string
  files: string[]
  status: 'pending' | 'done' | 'failed'
  did: string[]
  learn: string[]
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    'work-summary': { entries: WorkSummary[] }
  }
}
