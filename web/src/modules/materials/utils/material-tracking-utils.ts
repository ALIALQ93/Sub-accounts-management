export function isInboundStockMovement(commercialKind: string): boolean {
  return (
    commercialKind === "purchase" ||
    commercialKind === "return_sale" ||
    commercialKind === "opening_stock" ||
    commercialKind === "transfer_in"
  );
}

export function isOutboundStockMovement(commercialKind: string): boolean {
  return (
    commercialKind === "sale" ||
    commercialKind === "return_purchase" ||
    commercialKind === "transfer_out"
  );
}

export interface MaterialTrackingFlags {
  has_expiry_date?: boolean;
  require_expiry_on_inbound?: boolean;
  require_expiry_on_outbound?: boolean;
  has_serial_number?: boolean;
  require_serial_on_inbound?: boolean;
  require_serial_on_outbound?: boolean;
}

export interface PatternLineTracking {
  track_expiry_on_lines?: boolean;
  track_serial_on_lines?: boolean;
}

function flags(material: MaterialTrackingFlags | null | undefined) {
  return {
    has_expiry_date: Boolean(material?.has_expiry_date),
    require_expiry_on_inbound: Boolean(material?.require_expiry_on_inbound),
    require_expiry_on_outbound: Boolean(material?.require_expiry_on_outbound),
    has_serial_number: Boolean(material?.has_serial_number),
    require_serial_on_inbound: Boolean(material?.require_serial_on_inbound),
    require_serial_on_outbound: Boolean(material?.require_serial_on_outbound),
  };
}

export function showExpiryOnLine(
  material: MaterialTrackingFlags | null | undefined,
  commercialKind: string,
  pattern?: PatternLineTracking | null,
): boolean {
  if (pattern && pattern.track_expiry_on_lines === false) return false;
  if (!flags(material).has_expiry_date) return false;
  if (isInboundStockMovement(commercialKind)) return true;
  if (isOutboundStockMovement(commercialKind)) return true;
  return false;
}

export function showSerialOnLine(
  material: MaterialTrackingFlags | null | undefined,
  commercialKind: string,
  pattern?: PatternLineTracking | null,
): boolean {
  if (pattern && pattern.track_serial_on_lines === false) return false;
  if (!flags(material).has_serial_number) return false;
  if (isInboundStockMovement(commercialKind)) return true;
  if (isOutboundStockMovement(commercialKind)) return true;
  return false;
}

export function isExpiryRequiredOnLine(
  material: MaterialTrackingFlags,
  commercialKind: string,
): boolean {
  const f = flags(material);
  if (!f.has_expiry_date) return false;
  if (isInboundStockMovement(commercialKind)) {
    return f.require_expiry_on_inbound;
  }
  if (isOutboundStockMovement(commercialKind)) {
    return f.require_expiry_on_outbound;
  }
  return false;
}

export function isSerialRequiredOnLine(
  material: MaterialTrackingFlags,
  commercialKind: string,
): boolean {
  const f = flags(material);
  if (!f.has_serial_number) return false;
  if (isInboundStockMovement(commercialKind)) {
    return f.require_serial_on_inbound;
  }
  if (isOutboundStockMovement(commercialKind)) {
    return f.require_serial_on_outbound;
  }
  return false;
}
