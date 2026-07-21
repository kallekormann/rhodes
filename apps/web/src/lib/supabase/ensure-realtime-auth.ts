type RealtimeAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token?: string } | null };
    }>;
  };
  realtime: {
    setAuth: (token: string) => Promise<void>;
  };
};

let lastRealtimeToken: string | null = null;
let authInFlight: Promise<void> | null = null;

/** Set the Realtime JWT once per token to avoid reconnect storms from duplicate setAuth calls. */
export async function ensureRealtimeAuth(supabase: RealtimeAuthClient): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? null;
  if (!token) return;

  if (token === lastRealtimeToken) {
    return;
  }

  if (authInFlight) {
    await authInFlight;
    if (token === lastRealtimeToken) {
      return;
    }
  }

  authInFlight = supabase.realtime
    .setAuth(token)
    .then(() => {
      lastRealtimeToken = token;
    })
    .finally(() => {
      authInFlight = null;
    });

  await authInFlight;
}

export function resetRealtimeAuthCache(): void {
  lastRealtimeToken = null;
  authInFlight = null;
}
