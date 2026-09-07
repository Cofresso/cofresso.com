import { describe, expect, it } from 'vitest';
import { describeDbError, pgErrorField } from './errors';

/** Shape of what drizzle throws: a wrapper error carrying the driver error as `.cause`. */
function drizzleError(cause: Record<string, unknown>): Error {
  const err = new Error('Failed query: select * from carts where id = $1');
  err.name = 'DrizzleQueryError';
  (err as Error & { cause: unknown }).cause = Object.assign(new Error('duplicate key'), cause);
  return err;
}

describe('pgErrorField', () => {
  it('returns undefined for a plain Error', () => {
    expect(pgErrorField(new Error('boom'), 'code')).toBeUndefined();
    expect(pgErrorField(new Error('boom'), 'constraint_name')).toBeUndefined();
  });

  it('reads an own property when the driver error is thrown directly', () => {
    const err = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'orders_idempotency_key_unique',
    });
    expect(pgErrorField(err, 'code')).toBe('23505');
    expect(pgErrorField(err, 'constraint_name')).toBe('orders_idempotency_key_unique');
  });

  it('reads through .cause for the drizzle wrapper shape', () => {
    const err = drizzleError({ code: '23505', constraint_name: 'orders_idempotency_key_unique' });
    expect(pgErrorField(err, 'code')).toBe('23505');
    expect(pgErrorField(err, 'constraint_name')).toBe('orders_idempotency_key_unique');
  });

  it('prefers the own property over .cause', () => {
    const err = drizzleError({ code: '23505' });
    (err as unknown as Record<string, unknown>).code = '40001';
    expect(pgErrorField(err, 'code')).toBe('40001');
  });

  it('returns undefined for non-Error values', () => {
    expect(pgErrorField('boom', 'code')).toBeUndefined();
    expect(pgErrorField(null, 'code')).toBeUndefined();
    expect(pgErrorField(undefined, 'code')).toBeUndefined();
    expect(pgErrorField(42, 'code')).toBeUndefined();
  });
});

describe('describeDbError', () => {
  it('describes a plain Error without a pg code', () => {
    expect(describeDbError(new Error('boom'))).toEqual({ errName: 'Error', pgCode: undefined });
  });

  it('describes an error with an own code', () => {
    const err = Object.assign(new TypeError('duplicate key'), { code: '23505' });
    expect(describeDbError(err)).toEqual({ errName: 'TypeError', pgCode: '23505' });
  });

  it('describes the drizzle wrapper shape via .cause', () => {
    expect(describeDbError(drizzleError({ code: '40001' }))).toEqual({
      errName: 'DrizzleQueryError',
      pgCode: '40001',
    });
  });

  it('describes a non-Error value', () => {
    expect(describeDbError('boom')).toEqual({ errName: 'unknown', pgCode: undefined });
    expect(describeDbError(null)).toEqual({ errName: 'unknown', pgCode: undefined });
  });

  it('never includes the statement text or bound parameters', () => {
    const serialised = JSON.stringify(describeDbError(drizzleError({ code: '23505' })));
    expect(serialised).not.toContain('select');
    expect(serialised).not.toContain('carts');
  });
});
