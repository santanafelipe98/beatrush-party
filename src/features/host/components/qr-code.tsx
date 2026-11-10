import QRCode from "qrcode";
import { useMemo } from "react";

/** QR Code real (SVG), renderizado a partir da matriz de módulos. */
export function QrCode({ value, size = 168 }: { value: string; size?: number }) {
  const { count, dark } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const cells: string[] = [];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) cells.push(`M${x},${y}h1v1h-1z`);
    return { count: n, dark: cells.join("") };
  }, [value]);

  return (
    <div className="rounded-2xl bg-white p-3">
      <svg
        role="img"
        aria-label={`QR Code para ${value}`}
        width={size}
        height={size}
        viewBox={`0 0 ${count} ${count}`}
        shapeRendering="crispEdges"
      >
        <path d={dark} fill="#0f0f12" />
      </svg>
    </div>
  );
}
