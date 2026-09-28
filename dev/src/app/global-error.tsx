"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#f4f4f5" }}>
        <div style={{ textAlign: "center", padding: 32, background: "#fff", borderRadius: 20, border: "1px solid #ececee" }}>
          <h1 style={{ fontSize: 18 }}>GymOS hit an unexpected error</h1>
          <p style={{ color: "#71717a", fontSize: 14 }}>Please try again. If this continues, contact support@avnix.in.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              height: 40,
              padding: "0 16px",
              borderRadius: 10,
              border: 0,
              background: "#16a34a",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
