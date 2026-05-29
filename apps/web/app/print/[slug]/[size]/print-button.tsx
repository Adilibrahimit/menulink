"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ background: "#111", color: "#fff", padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", border: "none" }}
    >
      🖨️ طباعة / حفظ PDF
    </button>
  );
}
