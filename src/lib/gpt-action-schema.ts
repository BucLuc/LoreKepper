export function gptActionSchema(origin: string) {
  const response = {
    "200": {
      description: "Operation completed",
      content: {
        "application/json": {
          schema: { type: "object", additionalProperties: true },
        },
      },
    },
    "401": { description: "Connect your LoreKeeper account" },
    "409": { description: "Session changed or not ready; read again" },
  };
  const id = {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
    description: "Session ID copied from the lobby.",
  };
  const turn = {
    type: "object",
    required: [
      "requestId",
      "revision",
      "narrative",
      "summary",
      "title",
      "world",
      "questions",
      "resolvedActions",
    ],
    properties: {
      requestId: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Unique save ID. Reuse unchanged for an exact retry.",
      },
      revision: {
        type: "integer",
        description: "Revision from the latest readStorySession response.",
      },
      narrative: {
        type: "string",
        maxLength: 16000,
        description:
          "The new Markdown scene, without private state or old scenes.",
      },
      summary: { type: "string", maxLength: 12000 },
      title: { type: "string", maxLength: 120 },
      world: { type: "string", maxLength: 6000 },
      ending: { type: "boolean", default: false },
      questions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          required: ["player", "text"],
          properties: {
            player: { type: "string", format: "uuid" },
            text: { type: "string", maxLength: 2000 },
          },
        },
      },
      resolvedActions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          required: ["player", "action", "narrativeQuote"],
          properties: {
            player: { type: "string", format: "uuid" },
            action: {
              type: "string",
              description: "The exact submitted action.",
            },
            narrativeQuote: {
              type: "string",
              description:
                "A sentence copied from the scene showing the action's consequence.",
            },
          },
        },
      },
    },
  };
  return {
    openapi: "3.1.0",
    info: { title: "LoreKeeper ChatGPT stories", version: "1.0.0" },
    servers: [{ url: origin }],
    security: [{ LoreKeeperOAuth: ["stories:read", "stories:write"] }],
    paths: {
      "/api/story-bridge/sessions": {
        get: {
          operationId: "listStorySessions",
          summary: "List your recent ChatGPT stories",
          responses: response,
        },
      },
      "/api/story-bridge/sessions/{id}": {
        get: {
          operationId: "readStorySession",
          summary:
            "Read settings, answers, revision, readiness and narrator instructions",
          parameters: [id],
          responses: response,
        },
      },
      "/api/story-bridge/sessions/{id}/turns": {
        post: {
          operationId: "saveStoryTurn",
          summary: "Save one new scene when all players have answered",
          parameters: [id],
          "x-openai-isConsequential": false,
          requestBody: {
            required: true,
            content: { "application/json": { schema: turn } },
          },
          responses: response,
        },
      },
      "/api/story-bridge/stories": {
        post: {
          operationId: "importCompleteStory",
          summary:
            "Import the complete Markdown as a new completed interactive story",
          "x-openai-isConsequential": false,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "requestId",
                    "title",
                    "world",
                    "summary",
                    "markdown",
                  ],
                  properties: {
                    requestId: { type: "string", maxLength: 100 },
                    title: { type: "string", maxLength: 120 },
                    world: { type: "string", maxLength: 6000 },
                    summary: { type: "string", maxLength: 12000 },
                    markdown: {
                      type: "string",
                      maxLength: 75000,
                      description:
                        "Complete story, preserving every chapter and paragraph. Extract uploaded Markdown text first.",
                    },
                  },
                },
              },
            },
          },
          responses: response,
        },
      },
    },
    components: {
      securitySchemes: {
        LoreKeeperOAuth: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: `${origin}/connect/chatgpt`,
              tokenUrl: `${origin}/api/story-bridge/oauth/token`,
              scopes: {
                "stories:read": "Read your own stories and player answers",
                "stories:write":
                  "Save scenes and import stories into your account",
              },
            },
          },
        },
      },
    },
  };
}
