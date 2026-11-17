import { readNamedKey } from './keyConfig.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

Deno.test('reads the requested named key from the injected key map', () => {
  assert(
    readNamedKey('{"default":"public-placeholder","ops":"other"}') ===
      'public-placeholder',
    'expected the default key',
  )
  assert(
    readNamedKey('{"default":"public-placeholder","ops":"other"}', 'ops') ===
      'other',
    'expected the requested named key',
  )
})

Deno.test(
  'fails closed for absent, malformed, empty, and non-string keys',
  () => {
    for (const input of [
      undefined,
      '',
      'not-json',
      '[]',
      'null',
      '{}',
      '{"default":"  "}',
      '{"default":42}',
    ]) {
      assert(
        readNamedKey(input) === null,
        'expected missing key to fail closed',
      )
    }
  },
)
