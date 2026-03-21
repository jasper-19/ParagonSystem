export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';

  primaryColor: string; // Hex color code
  secondaryColor: string;

  sidebarCollapsed: boolean;

  fontFamily: 'inter' | 'roboto' | 'system';

  fontSize: 'small' | 'medium' | 'large';

  borderRadius: 'none' | 'small' | 'medium' | 'large';

  compactMode: boolean;

  animationsEnabled: boolean;

  dashboardLayout: 'default' | 'modern' | 'compact';
}
