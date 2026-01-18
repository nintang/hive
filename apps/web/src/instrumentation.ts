import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api"
import { registerOTel } from "@vercel/otel"
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions"

// Enable debug logging to see what's happening with OTEL
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)

export function register() {
  const spaceId = process.env.ARIZE_SPACE_ID || ""
  const apiKey = process.env.ARIZE_API_KEY || ""

  console.log("[Arize] Initializing with space_id:", spaceId ? "present" : "MISSING")
  console.log("[Arize] Initializing with api_key:", apiKey ? "present" : "MISSING")

  registerOTel({
    serviceName: "hivechat",
    attributes: {
      [SEMRESATTRS_PROJECT_NAME]: "hivechat",
    },
    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: "https://otlp.arize.com/v1/traces",
          headers: {
            space_id: spaceId,
            api_key: apiKey,
          },
        }),
        spanFilter: isOpenInferenceSpan,
      }),
    ],
  })

  console.log("[Arize] OpenTelemetry tracing initialized successfully")
}
