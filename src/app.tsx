import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

// ── Placeholder page components ──────────────────────────────────────────────
// Replace these imports with your actual EnviroLab components, e.g.:
// import Page1 from "./page1/App";
// import Page2 from "./page2/App";

const Page1 = () => "./page1";
const Page2 = () => "./page2";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PortalLink {
  label: string;
  description: string;
  path: string;
}

// ── Portal links config — add or edit entries here ───────────────────────────
const portals: PortalLink[] = [
  {
    label: "EnviroLab",
    description: "Page 1",
    path: "/page1",
  },
  {
    label: "EnviroLab",
    description: "Page 2",
    path: "/page2",
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const MonitorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M8 9l2.5 2.5L14 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Styles (inline — no external CSS dependency) ──────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  body: {
    margin: 0,
    minHeight: "100vh",
    backgroundColor: "#f4f6f8",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: "#1a1f26",
    display: "flex",
    flexDirection: "column",
  },
  pageWrapper: {
    maxWidth: 680,
    width: "100%",
    margin: "0 auto",
    padding: "3rem 1.5rem 2rem",
    display: "flex",
    flexDirection: "column",
    gap: "2.5rem",
    flex: 1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1a5c9a",
    color: "#fff",
    fontSize: 20,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    letterSpacing: "-0.5px",
  },
  siteTitle: {
    fontSize: 20,
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.2,
  },
  siteSub: {
    fontSize: 13,
    color: "#5a6472",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#9aa3ae",
    margin: 0,
  },
  cardGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e6ea",
    borderRadius: 12,
    padding: "1.1rem 1.25rem",
    textDecoration: "none",
    color: "inherit",
    boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)",
    transition: "box-shadow 0.2s ease, transform 0.15s ease, border-color 0.2s ease",
    cursor: "pointer",
  },
  cardHover: {
    boxShadow: "0 4px 12px rgba(0,0,0,0.10), 0 8px 32px rgba(0,0,0,0.07)",
    transform: "translateY(-2px)",
    borderColor: "#c2d4ea",
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#e8f0f9",
    color: "#1a5c9a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
  },
  cardDesc: {
    fontSize: 12,
    color: "#9aa3ae",
    fontFamily: "'Consolas', 'Courier New', monospace",
  },
  cardArrow: {
    color: "#9aa3ae",
    display: "flex",
    alignItems: "center",
    transition: "transform 0.15s ease, color 0.15s ease",
  },
  footer: {
    textAlign: "center" as const,
    fontSize: 12,
    color: "#9aa3ae",
    paddingTop: "1rem",
    borderTop: "1px solid #e2e6ea",
  },
};

// ── Portal card component ──────────────────────────────────────────────────────
const PortalCard = ({ portal }: { portal: PortalLink }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <Link
      to={portal.path}
      style={{
        ...styles.card,
        ...(hovered ? styles.cardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.cardIcon}>
        <MonitorIcon />
      </div>
      <div style={styles.cardBody}>
        <span style={styles.cardTitle}>{portal.label}</span>
        <span style={styles.cardDesc}>{portal.description}</span>
      </div>
      <div
        style={{
          ...styles.cardArrow,
          ...(hovered ? { transform: "translateX(3px)", color: "#1a5c9a" } : {}),
        }}
      >
        <ArrowIcon />
      </div>
    </Link>
  );
};

// ── Hub page ──────────────────────────────────────────────────────────────────
const Hub = () => (
  <div style={styles.body}>
    <div style={styles.pageWrapper}>
      <header style={styles.header}>
        <div style={styles.logoMark}>L</div>
        <div>
          <h1 style={styles.siteTitle}>LIMS Hosting Hub</h1>
          <p style={styles.siteSub}>ALS Limited — Results Entry</p>
        </div>
      </header>

      <main style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <p style={styles.sectionLabel}>Portals</p>
        <div style={styles.cardGrid}>
          {portals.map((portal) => (
            <PortalCard key={portal.path} portal={portal} />
          ))}
        </div>
      </main>

      <footer style={styles.footer}>
        <p>© {new Date().getFullYear()} ALS Limited — Internal Use Only</p>
      </footer>
    </div>
  </div>
);

// ── App with routing ──────────────────────────────────────────────────────────
import React from "react";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/page1" element={<Page1 />} />
      <Route path="/page2" element={<Page2 />} />
    </Routes>
  </BrowserRouter>
);

export default App;
