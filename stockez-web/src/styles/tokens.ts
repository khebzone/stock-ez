// Design tokens — single source of truth for the entire UI

export const colors = {
  // Brand — Professional emerald green
  primary:   '#059669',
  primaryDark: '#047857',
  primaryLight: '#10b981',
  primaryBg: '#ecfdf5',

  // Semantic
  success:   '#10b981',
  warning:   '#f59e0b',
  error:     '#ef4444',
  info:      '#06b6d4',
  purple:    '#8b5cf6',
  blue:      '#4361ee',

  // Sidebar
  sidebar:        '#064e3b',
  sidebarHover:   'rgba(255,255,255,0.08)',
  sidebarActive:  'rgba(255,255,255,0.15)',
  sidebarBorder:  'rgba(255,255,255,0.08)',
  sidebarText:    'rgba(255,255,255,0.75)',
  sidebarMuted:   'rgba(255,255,255,0.35)',

  // Layout
  pageBg:     '#f8fafc',
  headerBg:   '#ffffff',
  cardBg:     '#ffffff',

  // Text
  textPrimary:   '#1a1d2e',
  textSecondary: '#6b7280',
  textMuted:     '#9ca3af',

  // Borders
  border:      '#e8ecf0',
  borderLight: '#f0f2f5',

  // Status backgrounds (for pills)
  statusBgs: {
    PENDING_APPROVAL: { bg: '#fffbeb', color: '#f59e0b' },
    APPROVED:         { bg: '#ecfdf5', color: '#059669' },
    PACKING:          { bg: '#fff7ed', color: '#f97316' },
    PACKED:           { bg: '#ecfeff', color: '#06b6d4' },
    DISPATCHED:       { bg: '#f5f3ff', color: '#8b5cf6' },
    DELIVERED:        { bg: '#ecfdf5', color: '#10b981' },
    CANCELLED:        { bg: '#fef2f2', color: '#ef4444' },
    DRAFT:            { bg: '#f3f4f6', color: '#6b7280' },
  } as Record<string, { bg: string; color: string }>,
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  '2xl': 48,
};

export const radius = {
  sm:  6,
  md:  8,
  lg:  12,
  xl:  16,
  pill: 20,
};

export const shadows = {
  card:   '0 1px 3px rgba(0,0,0,0.04)',
  cardHover: '0 4px 16px rgba(0,0,0,0.08)',
  modal:  '0 25px 60px rgba(0,0,0,0.18)',
  header: '0 1px 3px rgba(0,0,0,0.04)',
  btn:    '0 2px 8px rgba(5,150,105,0.3)',
};

export const font = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  xs:  11,
  sm:  12,
  base: 14,
  md:  15,
  lg:  16,
  xl:  20,
  '2xl': 24,
  heading: 22,
};

// Chart colors palette
export const chartColors = [
  '#059669', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ef4444', '#ec4899', '#14b8a6',
];

// Ant Design theme token overrides
export const antdTheme = {
  token: {
    colorPrimary:   colors.primary,
    colorSuccess:   colors.success,
    colorWarning:   colors.warning,
    colorError:     colors.error,
    colorInfo:      colors.info,
    colorBgLayout:  colors.pageBg,
    colorBgContainer: colors.cardBg,
    borderRadius:   radius.md,
    borderRadiusLG: radius.lg,
    fontFamily:     font.family,
    fontSize:       font.base,
    colorText:      colors.textPrimary,
    colorTextSecondary: colors.textSecondary,
    colorBorder:    colors.border,
    boxShadow:      shadows.card,
  },
  components: {
    Menu: {
      darkItemBg:           colors.sidebar,
      darkSubMenuItemBg:    colors.sidebar,
      darkItemHoverBg:      colors.sidebarHover,
      darkItemSelectedBg:   colors.sidebarActive,
      darkItemSelectedColor: '#ffffff',
      darkItemColor:        colors.sidebarText,
      itemBorderRadius:     radius.md,
    },
    Card: {
      headerBg: colors.cardBg,
    },
    Table: {
      headerBg:         '#f8fafc',
      headerColor:      colors.textSecondary,
      rowHoverBg:       '#f0fdf4',
      borderColor:      colors.border,
      headerSortActiveBg: '#ecfdf5',
    },
    Button: {
      borderRadius: radius.md,
    },
    Input: {
      borderRadius: radius.md,
    },
    Select: {
      borderRadius: radius.md,
    },
  },
};
