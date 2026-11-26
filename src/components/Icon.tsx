// Simple line icons drawn for NOVA (24×24, stroke = currentColor). Decorative: the button or
// link around an icon carries the accessible name.

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  devices: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM14 17l2.5 2.5L21 15',
  activity: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  flow: 'M5 6h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10M16 15l3 3-3 3',
  robot: 'M8 8V5h8v3M5 8h14v9H5zM9 12h.01M15 12h.01M8 20h2M14 20h2',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  chevron: 'm9 6 6 6-6 6',
  stop: 'M8 8h8v8H8z',
  pause: 'M9 6v12M15 6v12',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  close: 'M6 6l12 12M18 6 6 18',
  // The three control kinds NOVA maps (C-02: switch, power_strip, toggle)
  switch: 'M7 3h10v18H7zM10.5 7h3v10h-3zM10.5 12h3',
  power_strip: 'M2 9h17v6H2zM6 12h.01M10 12h.01M14 12h.01M19 12h3',
  toggle: 'M8 4h8v16H8zM12 13l3-6M12 13h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  )
}
