import bcrypt from "bcrypt";
import { User, PublicUser } from "./user.types";
import * as repository from "./user.repository";

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function authenticate(username: string, password: string): Promise<User | null> {
  const user = await repository.findByUsername(username);
  if (!user) return null;

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
  const passwordHash = await bcrypt.hash(input.password, 10);
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
    repoPatch.passwordHash = await bcrypt.hash(patch.password, 10);
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
