import Svg, { G, Path } from 'react-native-svg';

import { brand } from '@/theme/tokens';

/**
 * The Tunar logo mark: the Y fork (a tuning fork whose arms curve into a Y) ringing with amber
 * waves, drawn without its tile. Same artwork as brand/tuner-icon.svg. The fork follows the text
 * colour; amber is only ever the waves.
 */
export function ForkMark({ size = 40, color = brand.ivory }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="170 220 684 610" accessibilityElementsHidden importantForAccessibility="no">
      <G fill="none" strokeLinecap="round">
        <Path d="M232 318 Q198 412 232 506" stroke="#8C6638" strokeWidth={30} transform="rotate(-12 222 412)" />
        <Path d="M792 318 Q826 412 792 506" stroke="#8C6638" strokeWidth={30} transform="rotate(12 802 412)" />
        <Path d="M298 292 Q258 400 298 508" stroke={brand.amber} strokeWidth={34} transform="rotate(-12 286 400)" />
        <Path d="M726 292 Q766 400 726 508" stroke={brand.amber} strokeWidth={34} transform="rotate(12 738 400)" />
        <Path d="M350 244 C374 430 420 540 512 590 C604 540 650 430 674 244" stroke={color} strokeWidth={66} strokeLinejoin="round" />
        <Path d="M512 588 V806" stroke={color} strokeWidth={66} />
      </G>
    </Svg>
  );
}
