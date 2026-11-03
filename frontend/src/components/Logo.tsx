import { Link } from 'react-router-dom';

export function Logo({ size = 34, to = '/' }: { size?: number; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 group" aria-label="ZIQWEAR home">
      <img
        src="/assets/img/logo-z.png"
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ height: size, width: size }}
      />
      <span className="font-display text-xl sm:text-2xl font-medium tracking-tight text-white group-hover:text-gold-600 transition-colors">
        ZIQWEAR
      </span>
    </Link>
  );
}
