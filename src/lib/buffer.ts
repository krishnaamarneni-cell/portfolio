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
  organizations: Array<{ id: string; name: string }>;
};

export async function getAccount(token: string): Promise<BufferAccount | null> {
  const j = await bufferGraphQL<{ account: BufferAccount }>(
    token,
    `{ account { id name email organizations { id name } } }`
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
  const orgId = account?.organizations?.[0]?.id;
  if (!orgId) return [];
  const j = await bufferGraphQL<{ channels: BufferChannel[] }>(
    token,
    `query($id: OrganizationId!) {
      channels(input: { organizationId: $id }) {
        id name service serviceId displayName avatar isDisconnected
      }
    }`,
    { id: orgId }
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

/** Normalize a Buffer metric field name → our canonical key. */
const METRIC_ALIASES: Record<string, keyof BufferPostMetrics> = {
  // direct
  reach: "reach",
  impressions: "impressions",
  clicks: "clicks",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  reactions: "reactions",
  replies: "replies",
  retweets: "retweets",
  saves: "saves",
  videoViews: "videoViews",
  engagementRate: "engagementRate",
  // common Buffer variants
  likeCount: "likes",
  commentCount: "comments",
  shareCount: "shares",
  impressionCount: "impressions",
  reachCount: "reach",
  clickCount: "clicks",
  videoViewCount: "videoViews",
  videoPlays: "videoViews",
  retweetCount: "retweets",
  replyCount: "replies",
  saveCount: "saves",
  reactionCount: "reactions",
  engagement: "reactions",
  engagements: "reactions",
};

type IntrospectField = {
  name: string;
  type: {
    name?: string;
    kind?: string;
    ofType?: { name?: string; kind?: string; ofType?: { name?: string } };
  };
};

type SchemaInfo = {
  /** scalar field names actually present on Post */
  postFields: Set<string>;
  /** input field names PostsInput accepts */
  postsInputFields: Set<string>;
  /** if PostMetric is a concrete object: its scalar field names */
  metricScalarFields: string[];
  /** if PostMetric is a union/interface: variant types + their scalar fields */
  metricVariants: Array<{ typeName: string; scalarFields: string[] }>;
};

let cachedSchema: SchemaInfo | null = null;

/** Returns the unwrapped scalar type name, or null if the field isn't a scalar. */
function unwrapScalar(t: IntrospectField["type"]): string | null {
  let cur: { kind?: string; name?: string; ofType?: { name?: string; kind?: string; ofType?: { name?: string } } } = t;
  while (cur && cur.kind && (cur.kind === "NON_NULL" || cur.kind === "LIST")) {
    cur = cur.ofType || {};
  }
  if (!cur) return null;
  if (cur.kind === "SCALAR" || cur.kind === "ENUM") return cur.name ?? null;
  return null;
}

async function discoverSchema(
  token: string
): Promise<SchemaInfo | { error: string }> {
  if (cachedSchema) return cachedSchema;
  const QUERY = `query {
    postsInput: __type(name: "PostsInput") {
      inputFields { name }
    }
    post: __type(name: "Post") {
      kind
      fields { name type { name kind ofType { name kind ofType { name } } } }
    }
    postMetric: __type(name: "PostMetric") {
      kind
      fields { name type { name kind ofType { name kind ofType { name } } } }
      possibleTypes {
        name
        fields { name type { name kind ofType { name kind ofType { name } } } }
      }
    }
  }`;
  const j = await bufferGraphQL<{
    postsInput?: { inputFields?: Array<{ name: string }> };
    post?: { fields?: IntrospectField[] };
    postMetric?: {
      kind?: string;
      fields?: IntrospectField[];
      possibleTypes?: Array<{ name: string; fields?: IntrospectField[] }>;
    };
  }>(token, QUERY);
  if (j.errors && j.errors.length) {
    return { error: j.errors.map((e) => e.message).join("; ") };
  }
  const postFields = new Set<string>(
    (j.data?.post?.fields ?? []).map((f) => f.name)
  );
  const postsInputFields = new Set<string>(
    (j.data?.postsInput?.inputFields ?? []).map((f) => f.name)
  );

  const metric = j.data?.postMetric;
  const metricScalarFields: string[] = [];
  const metricVariants: SchemaInfo["metricVariants"] = [];
  if (metric) {
    for (const f of metric.fields ?? []) {
      if (unwrapScalar(f.type)) metricScalarFields.push(f.name);
    }
    for (const v of metric.possibleTypes ?? []) {
      const scalars: string[] = [];
      for (const f of v.fields ?? []) {
        if (unwrapScalar(f.type)) scalars.push(f.name);
      }
      if (scalars.length > 0) {
        metricVariants.push({ typeName: v.name, scalarFields: scalars });
      }
    }
  }

  const info: SchemaInfo = {
    postFields,
    postsInputFields,
    metricScalarFields,
    metricVariants,
  };
  cachedSchema = info;
  return info;
}

/** Build the metrics { ... } sub-selection from discovered schema. */
function buildMetricsSelection(info: SchemaInfo): string {
  // Always include __typename so we can dispatch unions client-side.
  const parts: string[] = ["__typename"];
  for (const f of info.metricScalarFields) parts.push(f);
  for (const v of info.metricVariants) {
    parts.push(
      `... on ${v.typeName} { ${v.scalarFields.join(" ")} }`
    );
  }
  return parts.join(" ");
}

/** Build the Post { ... } sub-selection from discovered schema, asking only
 *  for fields we know how to consume. */
function buildPostSelection(info: SchemaInfo, metricsBody: string): string {
  const wanted = ["id", "text", "status", "sentAt", "dueAt"];
  const scalarParts = wanted.filter((f) => info.postFields.has(f));
  const parts: string[] = [...scalarParts];
  if (info.postFields.has("channel")) {
    parts.push(`channel { id name service }`);
  }
  if (info.postFields.has("metrics")) {
    parts.push(`metrics { ${metricsBody} }`);
  } else if (info.postFields.has("analytics")) {
    parts.push(`analytics { ${metricsBody} }`);
  }
  return parts.join(" ");
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/**
 * Sum the canonical metrics out of whatever shape Buffer returned. Buffer's
 * `metrics` can come back as an object of scalars, a nested object, OR a list
 * of {key/name/metric, value/count/total} — handle all so impressions/likes
 * don't silently read as zero.
 */
function normalizeMetrics(raw: unknown): BufferPostMetrics {
  const out: BufferPostMetrics = {};
  const add = (name: unknown, val: unknown) => {
    if (typeof name !== "string") return;
    const num = coerceNumber(val);
    if (num == null) return;
    const canonical = METRIC_ALIASES[name] ?? METRIC_ALIASES[name.toLowerCase()];
    if (canonical) out[canonical] = (out[canonical] ?? 0) + num;
  };
  const merge = (m: BufferPostMetrics) => {
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === "number") {
        out[k as keyof BufferPostMetrics] = (out[k as keyof BufferPostMetrics] ?? 0) + v;
      }
    }
  };
  if (!raw || typeof raw !== "object") return out;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name = o.key ?? o.name ?? o.metric ?? o.label ?? o.type ?? o.title;
      const val = o.value ?? o.count ?? o.total ?? o.amount ?? o.number ?? o.val;
      add(name, val);
    }
    return out;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k === "__typename") continue;
    if (v && typeof v === "object") {
      merge(normalizeMetrics(v)); // nested one level (e.g. { totals: {...} })
      continue;
    }
    add(k, v);
  }
  return out;
}

/**
 * Diagnostic: run the same sent-posts query but return the RAW node shapes so
 * we can see exactly what analytics Buffer exposes for this account.
 */
export async function debugSentPostsRaw(token: string): Promise<unknown> {
  const account = await getAccount(token);
  const orgId = account?.organizations?.[0]?.id;
  if (!orgId) return { error: "No Buffer organization on this token" };
  const schema = await discoverSchema(token);
  if ("error" in schema) return { schemaError: schema.error };
  const metricsBody = buildMetricsSelection(schema);
  const postBody = buildPostSelection(schema, metricsBody);
  const QUERY = `query($orgId: OrganizationId!) {
    posts(input: { organizationId: $orgId }) { edges { node { ${postBody} } } }
  }`;
  const j = await bufferGraphQL<{ posts?: { edges?: Array<{ node?: unknown }> } }>(token, QUERY, { orgId });
  const edges = j.data?.posts?.edges ?? [];
  return {
    schema: {
      postFields: Array.from(schema.postFields),
      hasMetricsField: schema.postFields.has("metrics"),
      hasAnalyticsField: schema.postFields.has("analytics"),
      metricScalarFields: schema.metricScalarFields,
      metricVariants: schema.metricVariants,
    },
    selection: postBody,
    graphqlErrors: j.errors ?? null,
    sampleNodes: edges.slice(0, 3).map((e) => e.node),
  };
}

/**
 * Fetch recent sent posts + analytics for one channel.
 *
 * Buffer's GraphQL `PostsInput` only takes `organizationId` — there are no
 * channelIds / status / first filters — so we pull everything for the org once
 * and filter client-side. Schema for Post + PostMetric is discovered via
 * introspection on first call and cached for the life of the process.
 */
export async function getSentPostsForChannel(
  token: string,
  channelId: string,
  first: number = 20
): Promise<{ posts: BufferSentPost[]; error?: string }> {
  const all = await getAllSentPosts(token);
  if ("error" in all) return { posts: [], error: all.error };
  const filtered = all.posts
    .filter((p) => p.channel?.id === channelId)
    .slice(0, first);
  return { posts: filtered };
}

/** Used by the analytics endpoint to fetch once and partition by channel. */
export async function getAllSentPosts(
  token: string
): Promise<{ posts: BufferSentPost[] } | { error: string }> {
  const account = await getAccount(token);
  const orgId = account?.organizations?.[0]?.id;
  if (!orgId) {
    return { error: "No Buffer organization found on this token" };
  }
  const schema = await discoverSchema(token);
  if ("error" in schema) return { error: schema.error };

  if (!schema.postsInputFields.has("organizationId")) {
    return {
      error:
        "Buffer schema unexpected — PostsInput has no organizationId field. Try a different access token.",
    };
  }

  const metricsBody = buildMetricsSelection(schema);
  const postBody = buildPostSelection(schema, metricsBody);

  const QUERY = `query($orgId: OrganizationId!) {
    posts(input: { organizationId: $orgId }) {
      edges {
        node { ${postBody} }
      }
    }
  }`;
  const j = await bufferGraphQL<{
    posts?: {
      edges?: Array<{
        node?: {
          id: string;
          text?: string;
          status?: string;
          sentAt?: string | null;
          dueAt?: string | null;
          channel?: { id: string; name: string; service: string } | null;
          metrics?: Record<string, unknown> | null;
          analytics?: Record<string, unknown> | null;
        };
      }>;
    };
  }>(token, QUERY, { orgId });
  if (j.errors && j.errors.length) {
    // Bust the cache so the next request re-introspects in case the schema moved.
    cachedSchema = null;
    return { error: j.errors.map((e) => e.message).join("; ") };
  }
  const edges = j.data?.posts?.edges ?? [];
  const posts: BufferSentPost[] = [];
  for (const e of edges) {
    const n = e.node;
    if (!n) continue;
    // Buffer's enum is lowercase strings (`sent`, `scheduled`, …). Be tolerant.
    const status = String(n.status ?? "").toLowerCase();
    if (status && status !== "sent") continue;
    const rawMetrics = (n.metrics ?? n.analytics ?? null) as
      | Record<string, unknown>
      | null;
    posts.push({
      id: n.id,
      text: n.text ?? "",
      sentAt: n.sentAt ?? null,
      serviceLink: null, // Buffer schema doesn't expose this — show via channel
      channel: n.channel ?? null,
      metrics: normalizeMetrics(rawMetrics),
    });
  }
  // Newest first.
  posts.sort((a, b) => {
    const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return tb - ta;
  });
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
