import type { ApiEndpointQuery } from './types.ts';

export async function apiFetch<T>(query: ApiEndpointQuery): Promise<T> {
  let response: Response;

  try {
    response = await fetch(query.url, {
      method: query.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...query.headers,
      },
      body: query.body === undefined ? undefined : JSON.stringify(query.body),
    });
  } catch {
    throw new Error(
      'No pudimos conectar con la API. Revisa tu conexión e intenta nuevamente.',
    );
  }

  if (!response.ok) {
    let message = `Error ${response.status}`;

    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === 'string') message = body.message;
      if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch {
      // Keep the status fallback.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
