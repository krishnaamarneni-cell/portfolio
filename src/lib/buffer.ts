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

/**
 * Buffer's createPost returns the PostActionPayload union:
 *   PostActionSuccess { post { id ... } }
 *   NotFoundError / UnauthorizedError / UnexpectedError / InvalidInputError /
 *   LimitReachedError / RestProxyError → each has a "message" String
 *   (RestProxyError also has link/code).
 */
const CREATE_POST_MUTATION = `mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status text dueAt } }
    ... on NotFoundError { message }
    ... on UnauthorizedError { message }
    ... on UnexpectedError { message }
    ... on InvalidInputError { message }
    ... on LimitReachedError { message }
    ... on RestProxyError { message link code }
  }
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

  const j = await bufferGraphQL<{
    createPost:
      | {
          __typename: "PostActionSuccess";
          post?: { id?: string; status?: string; text?: string; dueAt?: string };
        }
      | { __typename: string; message?: string; link?: string; code?: number };
  }>(token, CREATE_POST_MUTATION, { input });

  if (j.errors && j.errors.length) {
    return {
      channelId,
      ok: false,
      error: j.errors.map((e) => e.message).join("; "),
    };
  }
  const cp = j.data?.createPost;
  if (!cp) {
    return { channelId, ok: false, error: "Buffer returned no payload" };
  }
  if (cp.__typename === "PostActionSuccess") {
    const success = cp as { post?: { id?: string } };
    return { channelId, ok: true, postId: success.post?.id };
  }
  const errObj = cp as { __typename: string; message?: string; code?: number };
  return {
    channelId,
    ok: false,
    error: `${errObj.__typename}: ${errObj.message ?? "(no message)"}${errObj.code ? ` [code ${errObj.code}]` : ""}`,
  };
}
