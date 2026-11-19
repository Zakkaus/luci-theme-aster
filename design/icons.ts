/**
 * The page's icon registry: the shared Heroicons registry (every Astryx
 * semantic name) plus the `aster:*` namespaced keys for glyphs only this admin
 * shell draws. Namespaced keys keep the shared IconName list untouched
 * (`astryx docs icons component-and-library-icons`). `theme build` needs the
 * registry in its own module behind a named import.
 */
import {createElement, type ComponentType, type ReactNode, type SVGProps} from 'react';
import type {IconRegistry, NamespacedIconName} from '@astryxdesign/core/Icon';
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  ChartBarSquareIcon,
  CpuChipIcon,
  GlobeAltIcon,
  ServerStackIcon,
  Squares2X2Icon,
  WifiIcon,
} from '@heroicons/react/24/outline';
import {appIconRegistry} from './shared/icons';

// createElement, not JSX: `theme build` loads this module with the classic JSX runtime.
const icon = (svg: ComponentType<SVGProps<SVGSVGElement>>) =>
  createElement(svg, {width: '1em', height: '1em', 'aria-hidden': true});

export const asterIconRegistry: IconRegistry & Partial<Record<NamespacedIconName, ReactNode>> = {
  ...appIconRegistry,
  'aster:brand': icon(WifiIcon),
  'aster:status': icon(ChartBarSquareIcon),
  'aster:system': icon(CpuChipIcon),
  'aster:services': icon(Squares2X2Icon),
  'aster:network': icon(GlobeAltIcon),
  'aster:logout': icon(ArrowRightStartOnRectangleIcon),
  'aster:port': icon(ServerStackIcon),
  'aster:refresh': icon(ArrowPathIcon),
};
