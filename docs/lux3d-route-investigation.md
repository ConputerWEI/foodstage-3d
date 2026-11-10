# Aholo Lux3D quote-route investigation

Date: 2026-11-09 (Asia/Shanghai)

## Scope and safety

This investigation used only Aholo's official documentation and linked OpenAPI JSON, plus the installed skill source at `C:\Users\fuyao\.codex\skills\aholo-lux3d`. No API key was read, displayed, or used, and no paid request was made.

Primary sources:

- [Aholo API introduction](https://labs.aholo3d.cn/api-docs/intro)
- [Aholo API reference](https://labs.aholo3d.cn/api-docs/api-reference)
- [Current aggregate OpenAPI JSON](https://labs.aholo3d.cn/api-docs/openapi.json)

## Findings

### 1. `POST /lux3d/v1/pricing/openapi-quotes` is not in the current public OpenAPI JSON

The current aggregate specification declares OpenAPI 3.0.3 and lists the public services as Asset, World, Lux3D, and RenderCloud. Its `paths` include Lux3D generation, processing, export, task query/list, and related routes. A search of the complete fetched JSON found the documented Lux3D create routes, including:

- `/lux3d/v1/generate/img-to-3d/task/create`
- `/lux3d/v1/generate/text-to-3d/task/create`
- `/lux3d/v1/generate/material-transfer/task/create`
- `/lux3d/v1/generate/multimodal-to-image/task/create`
- `/lux3d/v1/generate/image-to-four-view/task/create`

It does **not** declare `/lux3d/v1/pricing/openapi-quotes`. It also does not declare `/lux3d/v1/account/balance`. Therefore, the quote route is not part of the current public OpenAPI contract, even though the installed skill treats it as a commerce service route. The API reference page itself says the JSON is the machine-readable specification: [API reference](https://labs.aholo3d.cn/api-docs/api-reference), [OpenAPI JSON](https://labs.aholo3d.cn/api-docs/openapi.json).

The introduction confirms the public gateway and says complete paths are determined by the API reference's Servers and paths: [introduction, production gateway](https://labs.aholo3d.cn/api-docs/intro#调用前须知). It describes Lux3D's public prefix as `/lux3d/v1` and gives a public create example, but does not document pricing quotes: [introduction, Lux3D](https://labs.aholo3d.cn/api-docs/intro#lux3d).

### 2. The installed skill's quote route is an internal/expected service contract, not a route supported by the current public spec

The installed runtime hard-codes:

- `ACCOUNT_PATH = "/lux3d/v1/account/balance"`
- `QUOTE_PATH = "/lux3d/v1/pricing/openapi-quotes"`

in `C:\Users\fuyao\.codex\skills\aholo-lux3d\core\runtime\commerce_client.py` (lines 33-35). It POSTs the quote request to that path after refreshing account state (lines 370-405).

The bundled commerce contract separately describes quote semantics and says the hosted service's internal paths are `/api/lux3d/account/balance` and `/api/lux3d/pricing/openapi-quotes` (`core\contracts\lux3d-commerce.v1.json`, lines 356-419). That is evidence of an intended site-service commerce contract, but it is not evidence that either path is currently published in Aholo's public OpenAPI JSON. The discrepancy between the internal `/api/...` contract notation and the runtime's public `/lux3d/v1/...` URL is an additional route/version risk.

### 3. `text-to-3d` payload path text is correct

The current public OpenAPI JSON declares:

`POST /lux3d/v1/generate/text-to-3d/task/create`

with a request body containing `prompt`, optional `style` and `img`, and `version` (`G1` or `G1-Turbo`), with examples for text-only and text-plus-reference-image generation: [OpenAPI JSON](https://labs.aholo3d.cn/api-docs/openapi.json) (search for `createTextTo3dTask` or `/lux3d/v1/generate/text-to-3d/task/create`).

The installed client sends exactly that path in `core\runtime\lux3d_client.py` lines 893-931. Its payload builder uses `prompt`, `version`, optional `style`, optional `img`, and the documented generation options in lines 534-566. The installed workflow contract independently records the same canonical path in `core\contracts\lux3d-generation.v1.json` lines 383-387 and `core\runtime\workflow_contracts.py` accepts canonical `/lux3d/v1/...` paths. Thus the text-to-3D operation name/path is not the probable cause of the quote-route failure.

Important distinction: quote `items[*].endpoint.path` is a description of the eventual create call. It should be `/lux3d/v1/generate/text-to-3d/task/create`, not `/lux3d/v1/pricing/openapi-quotes`; the latter is the commerce request URL used by the skill. The installed quote normalizer enforces a POST canonical `/lux3d/v1/` endpoint path (`workflow_contracts.py` lines 304-359).

## Why the observed error is `OPENAPI_UNAVAILABLE`

In `commerce_client.py` lines 282-324, the skill sends the request to the configured regional base URL, with `Authorization` and JSON headers. It maps HTTP 404 and all HTTP 5xx responses to `CommerceError("OPENAPI_UNAVAILABLE")` (lines 314-321). It maps 401/403 to `UNAUTHORIZED`, 429 to `RATE_LIMITED`, and a documented nonzero JSON envelope code to its specific error when recognized.

Consequently, `OPENAPI_UNAVAILABLE` is consistent with the quote path returning 404 or 5xx. It does **not** prove that the API key is invalid, and it does not mean the text-to-3D payload is malformed. Given that the current public spec contains no pricing route, the most probable root cause is:

> The installed skill is calling a commerce/pricing route that is absent from the currently published Aholo public OpenAPI surface, or is available only behind a separate site-service gateway/version not represented by the configured public base URL.

The fact that `GET /lux3d/v1/account/balance` works does not contradict this: the runtime treats account and quote as separate routes, and the public spec does not publish either one. Account availability can therefore be an implementation-specific or undocumented compatibility route while pricing remains absent, disabled, differently prefixed, or restricted. The evidence does not justify claiming that balance success authorizes a quote or generation.

## Non-spending diagnostic steps

Perform these steps with a redacted/synthetic credential only where the operation is explicitly non-billable and permitted by Aholo; do not retry generation or submit a paid task.

1. **Capture status and headers for the existing failed quote call without logging secrets or body contents.** Record only URL path, HTTP status, `Allow`, `Location`, `Content-Type`, request ID/correlation headers, and a hash or length of the response body. A 404 confirms route absence at that gateway; a 5xx points to an upstream/service deployment problem. Do not print `Authorization`, `uniqueId`, account data, or full response bodies.
2. **Check the exact base URL/region selected by the skill.** The runtime maps `cn` to `https://api.aholo3d.cn` and international to `https://api.aholo.ai/global` (`core\runtime\lux3d_client.py` lines 22-30). The public JSON server is only `https://api.aholo3d.cn` ([OpenAPI JSON](https://labs.aholo3d.cn/api-docs/openapi.json)). Do not switch regions or reuse a credential across regions as a workaround.
3. **Compare the live public spec, without credentials, to the installed expectations.** Download the linked [OpenAPI JSON](https://labs.aholo3d.cn/api-docs/openapi.json), enumerate `paths`, and verify whether either pricing or account appears. If Aholo publishes a separate official commerce specification or official release note, use that as the authority before changing the route; do not infer a new `/api/...` or `/v1/...` prefix from the bundled internal contract.
4. **Use an HTTP `OPTIONS` or unauthenticated `HEAD` probe only if Aholo explicitly permits it and the probe is known not to create work.** This can distinguish route/method handling (`404` versus `405` and `Allow`) but cannot establish quote availability or permission. Do not send a quote body merely to test alternatives, because quote requests may be account/commercial operations.
5. **Ask Aholo support for the current documented commerce endpoint and enablement status.** Provide the redacted path, region, timestamp, status code, and request ID. Ask specifically whether `pricing/openapi-quotes` is currently public, whether it uses `/lux3d/v1/...` or `/api/lux3d/...`, and whether a separate host or entitlement is required. Do not send the API key or quote payload in the ticket.
6. **Keep paid workflow blocked.** The installed skill's own workflow says missing or failed pricing is never free pricing (`references/openapi-workflow.md` lines 144-151) and says not to bypass quoting or reuse another operation's quote (`references/planning.md` lines 105-137). Until an official route is confirmed and a quote succeeds, do not submit the text-to-3D create request.

## Conclusion

- **Quote endpoint in current public spec:** No. `/lux3d/v1/pricing/openapi-quotes` is absent from the current official aggregate OpenAPI JSON.
- **Text-to-3D path:** Yes, `/lux3d/v1/generate/text-to-3d/task/create` is correct and matches both the current public spec and installed client.
- **Probable root cause:** A public-spec/installed-skill commerce-route mismatch (possibly an undocumented, disabled, separately hosted, or version-mismatched pricing service), not a text-to-3D payload path error and not established credential failure.
- **Operational result:** Treat `OPENAPI_UNAVAILABLE` as pricing unavailable; do not treat it as zero cost and do not make the paid create call until Aholo publishes or confirms the commerce route.
