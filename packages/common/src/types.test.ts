import { describe, it, expect } from 'vitest';
import { CreateUserSchema, SigninSchema, CreateRoomSchema } from './types';

describe('CreateUserSchema', () => {
  it('should validate correct input', () => {
    const result = CreateUserSchema.safeParse({
      username: 'john',
      password: 'password123',
      name: 'John Doe'
    });
    expect(result.success).toBe(true);
  });

  it('should reject short username', () => {
    const result = CreateUserSchema.safeParse({
      username: 'ab',
      password: 'password123',
      name: 'John'
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const result = CreateUserSchema.safeParse({
      username: 'john'
    });
    expect(result.success).toBe(false);
  });
});

describe('SigninSchema', () => {
  it('should validate correct input', () => {
    const result = SigninSchema.safeParse({
      username: 'john',
      password: 'password123'
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing password', () => {
    const result = SigninSchema.safeParse({
      username: 'john'
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateRoomSchema', () => {
  it('should validate correct input', () => {
    const result = CreateRoomSchema.safeParse({
      name: 'my-room'
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty name (schema allows it)', () => {
    const result = CreateRoomSchema.safeParse({
      name: ''
    });
    expect(result.success).toBe(true);
  });
});