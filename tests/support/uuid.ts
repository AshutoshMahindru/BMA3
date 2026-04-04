import { randomUUID } from 'crypto';

export function v4(): string {
  return randomUUID();
}

export default { v4 };
