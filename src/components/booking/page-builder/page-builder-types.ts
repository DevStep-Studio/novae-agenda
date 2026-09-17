export type DeviceMode = "desktop" | "tablet" | "mobile";

export type BlockType =
  | "company-header"
  | "cover-banner"
  | "bio-presentation"
  | "service-search"
  | "service-grid"
  | "professional-selector"
  | "booking-summary"
  | "location-map"
  | "working-hours"
  | "gallery-photos"
  | "faq-accordion"
  | "custom-text"
  | "footer"
  | "container";

export interface GlobalTokens {
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  textMutedColor: string;
  borderColor: string;
  fontHeading: string;
  fontBody: string;
  borderRadius: number; // in px: 0, 6, 8, 12, 16, 24
  containerWidth: number; // in px: 960, 1140, 1200, 1440
  themeMode: "auto" | "light" | "dark";
}

export interface ResponsiveProps {
  columns?: number;
  gap?: number;
  paddingY?: number;
  paddingX?: number;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  hideOnDesktop?: boolean;
  hideOnTablet?: boolean;
  hideOnMobile?: boolean;
  [key: string]: any;
}

export interface PageBlock {
  id: string;
  type: BlockType;
  name?: string;
  isLocked?: boolean; // Essential components that cannot be deleted
  props: Record<string, any>;
  responsive?: {
    mobile?: ResponsiveProps;
    tablet?: ResponsiveProps;
    desktop?: ResponsiveProps;
  };
  children?: PageBlock[];
}

export interface PageSection {
  id: string;
  name: string;
  isLocked?: boolean;
  props: {
    background?: string;
    paddingY?: number;
    maxWidth?: number;
    fullWidth?: boolean;
    gap?: number;
    columns?: number;
    direction?: "row" | "column";
    [key: string]: any;
  };
  responsive?: {
    mobile?: ResponsiveProps;
    tablet?: ResponsiveProps;
  };
  blocks: PageBlock[];
}

export interface PageBuilderDocument {
  schemaVersion: number;
  name?: string;
  globalTokens: GlobalTokens;
  sections: PageSection[];
}

export interface ComponentPropMeta {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "color" | "select" | "switch" | "slider" | "image";
  defaultValue?: any;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  category?: "content" | "layout" | "style" | "responsive";
}

export interface ComponentMeta {
  type: BlockType;
  name: string;
  category: "basics" | "identity" | "booking" | "content";
  iconName: string;
  description: string;
  isEssential?: boolean; // Protects booking flow
  allowChildren?: boolean;
  defaultProps: Record<string, any>;
  propDefinitions: ComponentPropMeta[];
}

export interface PageBuilderRevision {
  id: string;
  versionNumber: number;
  name?: string | null;
  createdAt: string;
  createdBy?: string | null;
  authorName?: string | null;
  layout: PageBuilderDocument;
  globalTokens: GlobalTokens;
}

export interface BookingPageRecord {
  id: string;
  companyId: string;
  status: "draft" | "published";
  draftLayout: PageBuilderDocument;
  publishedLayout: PageBuilderDocument | null;
  globalTokens: GlobalTokens;
  publishedAt: string | null;
  publishedBy: string | null;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
