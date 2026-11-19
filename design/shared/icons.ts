/**
 * Neutral's icon registry with Heroicons in place of Lucide, so the icons
 * components draw (close, chevrons, status, sort) match the Heroicons the
 * screens use. Same semantic names as neutral; `theme build` needs the
 * registry in its own module behind a named import.
 */
import {createElement, type ComponentType, type SVGProps} from 'react';
import type {IconRegistry} from '@astryxdesign/core/Icon';
import {
  ArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpIcon,
  ArrowUpTrayIcon,
  ArrowsUpDownIcon,
  Bars3Icon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  FunnelIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  StopIcon,
  ViewColumnsIcon,
  WrenchIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// createElement, not JSX: `theme build` loads this module with the classic
// JSX runtime, where JSX would need React in scope.
const icon = (svg: ComponentType<SVGProps<SVGSVGElement>>) =>
  createElement(svg, {width: '1em', height: '1em', 'aria-hidden': true});

export const appIconRegistry: IconRegistry = {
  close: icon(XMarkIcon),
  chevronDown: icon(ChevronDownIcon),
  chevronLeft: icon(ChevronLeftIcon),
  chevronRight: icon(ChevronRightIcon),
  chevronsLeft: icon(ChevronDoubleLeftIcon),
  chevronsRight: icon(ChevronDoubleRightIcon),
  check: icon(CheckIcon),
  success: icon(CheckCircleIcon),
  error: icon(XCircleIcon),
  warning: icon(ExclamationTriangleIcon),
  info: icon(InformationCircleIcon),
  calendar: icon(CalendarIcon),
  clock: icon(ClockIcon),
  externalLink: icon(ArrowTopRightOnSquareIcon),
  menu: icon(Bars3Icon),
  moreHorizontal: icon(EllipsisHorizontalIcon),
  search: icon(MagnifyingGlassIcon),
  upload: icon(ArrowUpTrayIcon),
  arrowUp: icon(ArrowUpIcon),
  arrowDown: icon(ArrowDownIcon),
  arrowsUpDown: icon(ArrowsUpDownIcon),
  funnel: icon(FunnelIcon),
  eyeSlash: icon(EyeSlashIcon),
  viewColumns: icon(ViewColumnsIcon),
  copy: icon(DocumentDuplicateIcon),
  // Heroicons has no double check; a single check reads the same at 1em.
  checkDouble: icon(CheckIcon),
  wrench: icon(WrenchIcon),
  stop: icon(StopIcon),
  microphone: icon(MicrophoneIcon),
};
