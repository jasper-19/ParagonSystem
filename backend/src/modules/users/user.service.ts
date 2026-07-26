import bcrypt from "bcrypt";
import { User, PublicUser, UserWithStaff } from "./user.types";
import * as repository from "./user.repository";

const BCRYPT_ROUNDS = Math.min(
  Math.max(Number(process.env.BCRYPT_ROUNDS) || 12, 12),
  14
);
const DUMMY_PASSWORD_HASH =
  "$2b$12$9o25rMoWQmEjAxCTDm4WkuleSRJx6.FErir5UD0La6G7u7r0mZ7JC";

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function authenticate(username: string, password: string): Promise<User | null> {
  const user = await repository.findByUsername(username);
  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) return null;

  await repository.setLastLogin(user.id);
  return user;
}

export async function createUser(input: {
  username: string;
  password: string;
  role: string;
  staffId?: string;
}): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const payload: { username: string; passwordHash: string; role: string; staffId?: string } = {
    username: input.username,
    passwordHash,
    role: input.role,
  };
  if (input.staffId) payload.staffId = input.staffId;
  return repository.create(payload);
}

export async function updateUser(
  id: string,
  patch: Partial<{ password: string; role: string; staffId: string | null; twoFaEnabled: boolean }>
): Promise<User | undefined> {
  const repoPatch: any = {};
  if (patch.password !== undefined) {
    repoPatch.passwordHash = await bcrypt.hash(patch.password, BCRYPT_ROUNDS);
  }
  if (patch.role !== undefined) {
    repoPatch.role = patch.role;
  }
  if (patch.staffId !== undefined) {
    repoPatch.staffId = patch.staffId;
  }
  if (patch.twoFaEnabled !== undefined) {
    repoPatch.twoFaEnabled = patch.twoFaEnabled;
  }

  return repository.updateUser(id, repoPatch);
}

export async function listUsers(): Promise<User[]> {
  return repository.listAll();
}

export async function getUserById(id: string): Promise<User | undefined> {
  return repository.findById(id);
}

export async function getUserWithStaffById(
  id: string
): Promise<UserWithStaff | undefined> {
  if (!id) {
    return undefined;
  }

  return repository
    .findByIdWithStaff(id);
}
