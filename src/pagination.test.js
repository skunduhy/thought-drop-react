import assert from 'node:assert/strict'
import test from 'node:test'
import { messageBlocks } from './pagination.js'

test('page breaks are separate blocks rather than visible paragraphs', () => {
  assert.deepEqual(messageBlocks('First paragraph.\r\n [page break] \r\nSecond paragraph.'), [
    { type: 'paragraph', text: 'First paragraph.', opening: true },
    { type: 'break' },
    { type: 'paragraph', text: 'Second paragraph.', opening: false },
  ])
})

test('blank lines and leading breaks do not consume the message opening', () => {
  assert.deepEqual(messageBlocks('\n[page break]\n\nHello.\n\nAgain.'), [
    { type: 'break' },
    { type: 'paragraph', text: 'Hello.', opening: true },
    { type: 'paragraph', text: 'Again.', opening: false },
  ])
})

test('a page break marker inside a paragraph remains literal text', () => {
  assert.deepEqual(messageBlocks('Mention [page break] here.'), [
    { type: 'paragraph', text: 'Mention [page break] here.', opening: true },
  ])
})
