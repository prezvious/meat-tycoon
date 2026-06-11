declare module '@iconify-icon/react' {
  import type { CSSProperties } from 'react';

  export function Icon(props: {
    icon: string | object;
    width?: string | number;
    height?: string | number;
    className?: string;
    style?: CSSProperties;
  }): JSX.Element;
}
