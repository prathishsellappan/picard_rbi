// In-memory stand-in for next/headers cookies(), shared by the mocked module.
export const cookieJar = new Map<string, string>();

export const cookieStore = {
  get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  set: (name: string, value: string) => void cookieJar.set(name, value),
  delete: (name: string) => void cookieJar.delete(name),
};

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
