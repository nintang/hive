import { registerOTel } from "@vercel/otel"
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions"

export function register() {
  const spaceId = process.env.ARIZE_SPACE_ID || ""
  const apiKey = process.env.ARIZE_API_KEY || ""

  // Skip if Arize credentials are not configured
  if (!spaceId || !apiKey) {
    return
  }

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
}
