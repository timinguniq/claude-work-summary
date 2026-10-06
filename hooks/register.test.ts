import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const engine = (on: On) => {
  on('session.root', () => ({ value: '/repo' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
}

const PANE = {
  plugin: 'work-summary',
  component: 'Pane',
  requestId: 'work-summary',
  props: {
    title: '작업 요약',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

const SUMMARY = '한 일:\n- 홈 버튼 색을 토큰으로 바꿈\n배울 점:\n- 색은 design-guide 토큰만 쓴다'

const edit = (file_path: string) =>
  ({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as const

const endTurn = (turnId: string) =>
  ({ answer: '고쳤습니다', durationMs: 1, isAborted: false, turnId, reason: 'answer' }) as const

test('an editing turn lists its files at once and its summary once the fork answers', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  on('tool.call', () => ({ result: {} as never }))
  on('model.fork', () => ({ value: { isAnswered: true, text: SUMMARY, usage: USAGE } }))

  await $.turn.start({ text: '홈 버튼 고쳐줘\n자세히는 이렇고', turnId: 't1' })
  await $.tool.call(edit('/repo/presentation/Home.kt'))
  await $.tool.call({ tool: 'Read', file_path: '/repo/README.md' })
  await $.turn.complete(endTurn('t1'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: '▸ 홈 버튼 고쳐줘' })).toBeDefined()
    expect(await ui.find({ text: 'presentation/Home.kt' })).toBeDefined()
    expect(await ui.find({ text: 'README.md' })).toBeUndefined()
    await ui.unmount()
  }

  const pending = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pending.press({ key: 'did' })
  expect(await pending.find({ text: '요약 중' })).toBeDefined()
  await clock.advance(10)
  expect(await pending.find({ text: '요약 중' })).toBeUndefined()
  expect(await pending.find({ text: '홈 버튼 색을 토큰으로 바꿈' })).toBeDefined()
  await pending.press({ key: 'learn' })
  expect(await pending.find({ text: '색은 design-guide 토큰만 쓴다' })).toBeDefined()
  await pending.unmount()
})

test('each tab shows its own section alone', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  on('tool.call', () => ({ result: {} as never }))
  on('model.fork', () => ({ value: { isAnswered: true, text: SUMMARY, usage: USAGE } }))

  await $.turn.start({ text: '홈 버튼 고쳐줘', turnId: 't1' })
  await $.tool.call(edit('/repo/presentation/Home.kt'))
  await $.turn.complete(endTurn('t1'))
  await clock.advance(10)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const shows = async (files: boolean, did: boolean, learn: boolean) => {
      expect(await ui.find({ text: '▸ 홈 버튼 고쳐줘' })).toBeDefined()
      expect((await ui.find({ text: 'presentation/Home.kt' })) !== undefined).toBe(files)
      expect((await ui.find({ text: '홈 버튼 색을 토큰으로 바꿈' })) !== undefined).toBe(did)
      expect((await ui.find({ text: '색은 design-guide 토큰만 쓴다' })) !== undefined).toBe(learn)
    }

    for (const [key, hotkey] of [['files', '1'], ['did', '2'], ['learn', '3']] as const) {
      expect((await ui.find({ type: 'Button', key }))?.props.hotkey).toBe(hotkey)
    }

    await ui.press({ key: 'files' })
    await shows(true, false, false)
    await ui.press({ key: 'did' })
    await shows(false, true, false)
    await ui.press({ key: 'learn' })
    await shows(false, false, true)
    await ui.unmount()
  }
})

test('a summary with no lesson says so on its tab', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  on('tool.call', () => ({ result: {} as never }))
  on('model.fork', () => ({ value: { isAnswered: true, text: '한 일:\n- 고침', usage: USAGE } }))

  await $.turn.start({ text: '고쳐줘', turnId: 't1' })
  await $.tool.call(edit('/repo/a.kt'))
  await $.turn.complete(endTurn('t1'))
  await clock.advance(10)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'learn' })
  expect(await ui.find({ text: '없음' })).toBeDefined()
  await ui.unmount()
})

test('a turn whose edits all failed leaves no entry', async ($, on) => {
  mock.clock(on)
  engine(on)
  on('tool.call', () => ({ result: {} as never, isError: true as const }))

  await $.turn.start({ text: '고쳐줘', turnId: 't1' })
  await $.tool.call(edit('/repo/a.kt'))
  await $.turn.complete(endTurn('t1'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: '파일을 바꾼 턴이 끝나면' })).toBeDefined()
  await ui.unmount()
})

test('a fork that fails says why in the entry', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  on('tool.call', () => ({ result: {} as never }))
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'empty-reply', usage: USAGE } }))

  await $.turn.start({ text: '고쳐줘', turnId: 't1' })
  await $.tool.call(edit('/repo/a.kt'))
  await $.turn.complete(endTurn('t1'))
  await clock.advance(10)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'did' })
  expect(await ui.find({ text: '요약 실패: empty-reply' })).toBeDefined()
  await ui.unmount()
})
