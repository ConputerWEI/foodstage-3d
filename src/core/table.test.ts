import { describe, expect, it } from 'vitest';
import { parseTable } from './table';

describe('table URL parsing', () => {
  it.each([
    ['?table=a01', 'A01'], ['?table=terrace-2', 'TERRACE-2'],
    ['?table=A', 'A'], ['?table=123456789012', '123456789012'],
    ['', null], ['?other=A01', null], ['?table=', null],
    ['?table=A%2001', null], ['?table=%3Cscript%3E', null],
    ['?table=1234567890123', null], ['?table=-A', null],
    ['?table=A-', null], ['?table=桌1', null], ['?table=A01&table=B02', null],
  ])('parses %s as %s', (search, expected) => {
    expect(parseTable(search)).toBe(expected);
  });
});
