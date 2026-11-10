/** Cores dos avatares (índice salvo em Player.avatar). */
export const AVATAR_COLORS = [
  "#FF0080",
  "#00DFD8",
  "#F59E0B",
  "#7928CA",
  "#10B981",
  "#E4E6F0",
  "#FF6AB0",
  "#5EE6E0",
  "#9B5DE0",
  "#FFC15E",
] as const;

export const SHAPES = [
  { name: "triângulo", color: "#EF4444", clip: "polygon(50% 8%,92% 88%,8% 88%)" },
  { name: "losango", color: "#3B82F6", clip: "polygon(50% 0,100% 50%,50% 100%,0 50%)" },
  { name: "círculo", color: "#F59E0B", clip: "circle(50%)" },
  { name: "quadrado", color: "#10B981", clip: "inset(8%)" },
] as const;

/** Variantes escurecidas usadas nos botões grandes da TV. */
export const SHAPE_TV_COLORS = ["#EF4444", "#3B82F6", "#B7791F", "#0E8F63"] as const;
