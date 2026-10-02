import { describe, it, expect } from 'vitest';
import { CreateUserSchema, SigninSchema, CreateRoomSchema, InviteMemberSchema, UpdateRoomSchema } from './types';

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

  it('should reject passwords shorter than 8 characters', () => {
    const result = CreateUserSchema.safeParse({
      username: 'john',
      password: 'short',
      name: 'John'
    });
    expect(result.success).toBe(false);
  });

  it('should reject an empty name', () => {
    const result = CreateUserSchema.safeParse({
      username: 'john',
      password: 'password123',
      name: '   '
    });
    expect(result.success).toBe(false);
  });

  it('should accept an email address as username', () => {
    const result = CreateUserSchema.safeParse({
      username: 'someone.with.a.long.name@example.com',
      password: 'password123',
      name: 'Someone'
    });
    expect(result.success).toBe(true);
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

  it('should reject an empty name', () => {
    const result = CreateRoomSchema.safeParse({
      name: ''
    });
    expect(result.success).toBe(false);
  });

  it('should reject names that are not URL safe', () => {
    for (const name of ['my room', 'a/b', '../x', 'ünïcode']) {
      expect(CreateRoomSchema.safeParse({ name }).success).toBe(false);
    }
  });
});
describe('private rooms', () => {
  it('rooms are public unless asked otherwise', () => {
    const result = CreateRoomSchema.parse({ name: 'my-room' });
    expect(result.isPrivate).toBe(false);
    expect(CreateRoomSchema.parse({ name: 'my-room', isPrivate: true }).isPrivate).toBe(true);
  });

  it('validates privacy updates and invites', () => {
    expect(UpdateRoomSchema.safeParse({ isPrivate: 'yes' }).success).toBe(false);
    expect(InviteMemberSchema.safeParse({ username: ' bob@example.com ' }).data?.username).toBe('bob@example.com');
    expect(InviteMemberSchema.safeParse({}).success).toBe(false);
  });
});
