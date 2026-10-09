declare module 'feather-icons' {
  const feather: { icons: Record<string, { toSvg: (attributes?: Record<string, string | number>) => string }> };
  export default feather;
}
