/**
 * Buffer's classic API (api.bufferapp.com) was deprecated for new tokens.
 * Current tokens from buffer.com/developers/apps are OIDC and only work
 * against the new GraphQL endpoint at https://api.buffer.com/graphql.
 *
 * This helper wraps the GraphQL endpoint with the connector's bearer token.
 */

const BUFFER_GRAPHQL = "https://api.buffer.com/graphql";

export type BufferGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

export async function bufferGraphQL<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<BufferGraphQLResponse<T>> {
  const r = await fetch(BUFFER_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!r.ok && r.status !== 400) {
    return {
      errors: [{ message: `Buffer HTTP ${r.status}` }],
    };
  }
  try {
    return (await r.json()) as BufferGraphQLResponse<T>;
  } catch (err) {
    return {
      errors: [
        { message: err instanceof Error ? err.message : "Invalid response" },
      ],
    };
  }
}

export type BufferAccount = {
  id: string;
  name: string;
  email: string;
  currentOrganization: { id: string; name: string };
};

export async function getAccount(token: string): Promise<BufferAccount | null> {
  const j = await bufferGraphQL<{ account: BufferAccount }>(
    token,
    `{ account { id name email currentOrganization { id name } } }`
  );
  return j.data?.account ?? null;
}

export type BufferChannel = {
  id: string;
  name: string;
  service: string; // "linkedin" | "instagram" | "twitter" | ...
  serviceId: string;
  displayName: string;
  avatar?: string;
  isDisconnected: boolean;
};

export async function getChannels(token: string): Promise<BufferChannel[]> {
  const account = await getAccount(token);
  if (!account?.currentOrganization?.id) return [];
  const j = await bufferGraphQL<{ channels: BufferChannel[] }>(
    token,
    `query($id: OrganizationId!) {
      channels(input: { organizationId: $id }) {
        id name service serviceId displayName avatar isDisconnected
      }
    }`,
    { id: account.currentOrganization.id }
  );
  return j.data?.channels ?? [];
}

export type BufferPostResult = {
  channelId: string;
  ok: boolean;
  error?: string;
  postId?: string;
};

const CREATE_POST_MUTATION = `mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on CreatePostSuccess { post { id status text dueAt } }
    ... on CreatePostError { message }
    ... on UserError { message }
    ... on PostError { message }
  }
}`;

const FALLBACK_CREATE_POST_MUTATION = `mutation($input: CreatePostInput!) {
  createPost(input: $input)
}`;

type ShareMode =
  | "shareNow"
  | "addToQueue"
  | "shareNext"
  | "customScheduled"
  | "recommendedTime";

export async function createBufferPost({
  token,
  channelId,
  text,
  mode = "addToQueue",
  dueAt,
  imageUrl,
}: {
  token: string;
  channelId: string;
  text: string;
  mode?: ShareMode;
  dueAt?: string; // ISO when mode === "customScheduled"
  imageUrl?: string;
}): Promise<BufferPostResult> {
  const input: Record<string, unknown> = {
    channelId,
    text,
    mode,
    schedulingType: "automatic",
  };
  if (imageUrl) {
    input.assets = [{ image: { url: imageUrl } }];
  }
  if (mode === "customScheduled" && dueAt) {
    input.dueAt = dueAt;
  }

  // Try the typed mutation first — falls back to a plain scalar if the schema
  // differs. Either way we surface a useful error message to the UI.
  let j = await bufferGraphQL<{ createPost: unknown }>(
    token,
    CREATE_POST_MUTATION,
    { input }
  );

  if (j.errors && j.errors.some((e) => /Fragment|InlineFragment|Selections|Spread/.test(e.message))) {
    j = await bufferGraphQL<{ createPost: unknown }>(
      token,
      FALLBACK_CREATE_POST_MUTATION,
      { input }
    );
  }

  if (j.errors && j.errors.length) {
    return {
      channelId,
      ok: false,
      error: j.errors.map((e) => e.message).join("; "),
    };
  }
  const cp = j.data?.createPost as
    | { post?: { id?: string }; message?: string }
    | string
    | undefined;
  if (cp && typeof cp === "object" && cp.message) {
    return { channelId, ok: false, error: cp.message };
  }
  const postId =
    cp && typeof cp === "object" && cp.post?.id ? cp.post.id : undefined;
  return { channelId, ok: true, postId };
}
