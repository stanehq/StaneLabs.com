import feather from 'feather-icons';
type IconName = keyof typeof feather.icons;
export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: 16 | 20 | 24; className?: string }) {
  return <span aria-hidden="true" className={`icon ${className}`} dangerouslySetInnerHTML={{ __html: feather.icons[name].toSvg({ width: size, height: size, 'stroke-width': 1.5 }) }} />;
}
