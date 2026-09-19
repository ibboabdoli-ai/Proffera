import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f9fd",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: 1016,
            height: 466,
            display: "flex",
            alignItems: "center",
            padding: "70px 78px",
            borderRadius: 20,
            background: "#ffffff",
          }}
        >
          <div
            style={{
              width: 250,
              height: 250,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              background: "#eef5ff",
              marginRight: 56,
            }}
          >
            <svg
              width="205"
              height="205"
              viewBox="0 0 300 300"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="104" y="64" width="38" height="168" rx="18" fill="#0a2e63" />
              <path
                d="M123 64h62a58 58 0 0 1 0 116h-62"
                fill="none"
                stroke="#0a2e63"
                strokeWidth="38"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="50" y="160" width="62" height="30" rx="15" fill="#0a2e63" />
              <rect x="72" y="194" width="42" height="30" rx="15" fill="#0a2e63" />
              <rect x="30" y="228" width="84" height="30" rx="15" fill="#0a2e63" />
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 94,
                lineHeight: 1,
                fontWeight: 800,
                color: "#11213b",
                marginBottom: 24,
              }}
            >
              Proffera
            </div>
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.35,
                fontWeight: 600,
                color: "#617085",
                maxWidth: 600,
              }}
            >
              Bokning, CRM och AI-assistent för tjänsteföretag
            </div>
            <div
              style={{
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 700,
                color: "#0a2e63",
                marginTop: 34,
              }}
            >
              proffera.se
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
