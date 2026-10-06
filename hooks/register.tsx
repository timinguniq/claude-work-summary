import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { WorkSummary } from '../types'

const PANE = 'work-summary'
const TITLE = '작업 요약'
const KEEP = 20
const SHOWN_FILES = 8
const ANSWER_CHARS = 3000

const entries = atom({ plugin: 'work-summary', key: 'entries' } as const, [])

let turn = { id: '', prompt: '' }
let changed = new Set<string>()

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'work-summary',
      description: '바꾼 파일·한 일·배울 점 패널을 엽니다',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'work-summary' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: '작업 요약 패널을 열었습니다.' }
  })

  on('turn.start', ($, e, next) => {
    turn = { id: e.turnId, prompt: e.text }
    changed = new Set()

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const path = editedPath(e)
    if (path === undefined) return next(e)
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) changed.add(path)

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || e.turnId !== turn.id || changed.size === 0) return done

    const root = await $.session.root()
    const entry: WorkSummary = {
      turnId: e.turnId,
      prompt: firstLine(turn.prompt),
      files: [...changed].map(path => relative(root, path)),
      status: 'pending',
      did: [],
      learn: [],
      error: '',
    }
    changed = new Set()
    await update($, entries, list => [entry, ...list].slice(0, KEEP))
    $.clock.after(10, () => void summarize($, entry, e.answer))

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, entries)
    if (list.length === 0) {
      return <Text dimColor>파일을 바꾼 턴이 끝나면 여기에 요약이 쌓입니다.</Text>
    }

    return (
      <Box flexDirection="column">
        {list.map(entry => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold wrap="truncate-end">▸ {entry.prompt}</Text>
            <Text dimColor>바꾼 파일</Text>
            {entry.files.slice(0, SHOWN_FILES).map(file => (
              <Text wrap="truncate-start">  {file}</Text>
            ))}
            {entry.files.length > SHOWN_FILES && (
              <Text dimColor>  외 {entry.files.length - SHOWN_FILES}개</Text>
            )}
            {entry.status === 'pending' && <Text dimColor>요약 중…</Text>}
            {entry.status === 'failed' && <Text dimColor>요약 실패: {entry.error}</Text>}
            {entry.did.length > 0 && <Text dimColor>한 일</Text>}
            {entry.did.map(line => <Text>  • {line}</Text>)}
            {entry.learn.length > 0 && <Text dimColor>배울 점</Text>}
            {entry.learn.map(line => <Text>  • {line}</Text>)}
          </Box>
        ))}
      </Box>
    )
  })
}

function editedPath(e: ToolCallInput): string | undefined {
  if (e.tool === 'Edit' || e.tool === 'Write') return e.file_path
  if (e.tool === 'NotebookEdit') return e.notebook_path

  return undefined
}

async function summarize($: EngineInterface, entry: WorkSummary, answer: string) {
  const reply = await $.model.fork({ prompt: summaryPrompt(entry.files, answer) })
  const patch = reply.isAnswered
    ? parseSummary(reply.text)
    : { status: 'failed' as const, error: reply.reason }
  await update($, entries, list =>
    list.map(one => (one.turnId === entry.turnId ? { ...one, ...patch } : one)),
  )
}

function summaryPrompt(files: string[], answer: string): string {
  return [
    '[작업 요약 패널용 요청 — 대화에는 남지 않는다]',
    '방금 끝난 턴에서 너는 아래 파일을 바꿨고, 마지막에 아래처럼 답했다.',
    `바꾼 파일: ${files.join(', ')}`,
    `마지막 답변: ${answer.slice(0, ANSWER_CHARS)}`,
    '',
    '도구를 쓰지 말고, 아래 형식 그대로 한국어로만 답해. 형식 밖의 말은 붙이지 마.',
    '한 일:',
    '- 무엇을 왜 바꿨는지 (1~3줄, 줄마다 70자 이내)',
    '배울 점:',
    '- 이번 작업에서 드러난, 다음에도 쓸 만한 구체적인 교훈 (1~2줄, 줄마다 70자 이내, 일반론 금지)',
  ].join('\n')
}

export function parseSummary(text: string): Pick<WorkSummary, 'status' | 'did' | 'learn'> {
  const did: string[] = []
  const learn: string[] = []
  let into: string[] | undefined
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('한 일')) into = did
    else if (line.startsWith('배울 점')) into = learn
    else if (line.startsWith('-') && into !== undefined) into.push(line.replace(/^-\s*/, ''))
  }
  if (did.length + learn.length === 0) did.push(text.trim())

  return { status: 'done', did, learn }
}

function firstLine(prompt: string): string {
  const line = prompt.trim().split('\n')[0] ?? ''

  return line === '' ? '(이어서 한 작업)' : line
}

function relative(root: string, path: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path
}
