// svg for a bar
export function barPath(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2)
  return `M${x} ${base} v${-(h - r)} q0 ${-r} ${r} ${-r} h${w - 2 * r} q${r} 0 ${r} ${r} v${h - r} z`
}
