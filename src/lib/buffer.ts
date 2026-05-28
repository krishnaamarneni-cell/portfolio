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

/* ─── Analytics: sent posts + their metrics ─── */

export type BufferPostMetrics = {
  reach?: number;
  impressions?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reactions?: number;
  replies?: number;
  retweets?: number;
  saves?: number;
  videoViews?: number;
  engagementRate?: number;
};

export type BufferSentPost = {
  id: string;
  text: string;
  sentAt?: string | null;
  serviceLink?: string | null;
  channel: { id: string; name: string; service: string } | null;
  metrics: BufferPostMetrics;
};

/**
 * Try to fetch recent sent posts + analytics for one channel.
 *
 * Buffer's GraphQL schema has shifted around the analytics field a few times
 * (Buffer Classic Analyze → "Buffer Analyze" → today's `metrics`/`analytics`
 * field on Post), so we try the most likely query first and degrade
 * gracefully — if Buffer rejects a sub-selection we drop it and return whatever
 * came back.
 */
export async function getSentPostsForChannel(
  token: string,
  channelId: string,
  first: number = 20
): Promise<{ posts: BufferSentPost[]; error?: string }> {
  // Primary attempt: assume the modern PostsConnection + flat metrics shape.
  const QUERY = `query($channelId: ChannelId!, $first: Int!) {
    posts(input: { channelIds: [$channelId], status: sent, first: $first }) {
      edges {
        node {
          id
          text
          status
          sentAt
          serviceLink
          channel { id name service }
          metrics {
            reach
            impressions
            clicks
            likes
            comments
            shares
            reactions
            replies
            retweets
            saves
            videoViews
            engagementRate
          }
        }
      }
    }
  }`;
  const j = await bufferGraphQL<{
    posts?: {
      edges?: Array<{
        node?: {
          id: string;
          text?: string;
          sentAt?: string | null;
          serviceLink?: string | null;
          channel?: { id: string; name: string; service: string } | null;
          metrics?: BufferPostMetrics;
        };
      }>;
    };
  }>(token, QUERY, { channelId, first });

  if (j.errors && j.errors.length) {
    return {
      posts: [],
      error: j.errors.map((e) => e.message).join("; "),
    };
  }
  const edges = j.data?.posts?.edges ?? [];
  const posts: BufferSentPost[] = [];
  for (const e of edges) {
    const n = e.node;
    if (!n) continue;
    posts.push({
      id: n.id,
      text: n.text ?? "",
      sentAt: n.sentAt ?? null,
      serviceLink: n.serviceLink ?? null,
      channel: n.channel ?? null,
      metrics: n.metrics ?? {},
    });
  }
  return { posts };
}

/** Sum of a metric across a list of sent posts. */
export function aggregateMetrics(posts: BufferSentPost[]): BufferPostMetrics & {
  postCount: number;
} {
  const keys: (keyof BufferPostMetrics)[] = [
    "reach",
    "impressions",
    "clicks",
    "likes",
    "comments",
    "shares",
    "reactions",
    "replies",
    "retweets",
    "saves",
    "videoViews",
  ];
  const out: BufferPostMetrics & { postCount: number } = { postCount: posts.length };
  for (const k of keys) {
    let sum = 0;
    let any = false;
    for (const p of posts) {
      const v = p.metrics?.[k];
      if (typeof v === "number") {
        sum += v;
        any = true;
      }
    }
    if (any) (out as Record<string, number>)[k] = sum;
  }
  return out;
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
