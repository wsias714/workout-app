/* ----------------------------- design tokens ----------------------------- */
// "Chalk" light/blueprint direction blended with picks from the other mocks:
// paper-white surfaces, cobalt accent, mono numerals for data, friendly rounding.
// NOTE: token name `amber` now holds the cobalt ACCENT (kept the key name to limit
// churn); `cyan` = teal data color; `pr` = amber, reserved for PR pops only.
export const C = {
  bg: "#F4F3EF",
  surface: "#FFFFFF",
  surface2: "#F0EFEA",
  line: "#E3E1D9",
  ink: "#16181C",
  muted: "#777C86",
  amber: "#2563EB",     // primary accent (cobalt)
  amberDim: "#E6ECFD",  // accent tint (chips, active states)
  cyan: "#1F8F7E",      // data / secondary (teal)
  cyanDim: "#E2F1EE",   // teal tint
  good: "#16A36B",      // completed set (green)
  bad: "#E5483D",       // destructive
  pr: "#F59E0B",        // PR badge pop (amber)
  onAccent: "#FFFFFF",  // text on accent/good
  onPr: "#3A2A05",      // text on PR amber
  shadow: "0 1px 3px rgba(20,22,30,.06)",
};
export const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
export const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
