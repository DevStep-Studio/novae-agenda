import type { PageBuilderDocument, GlobalTokens } from "./page-builder-types";

export interface PageTemplate {
  id: string;
  name: string;
  category: "general" | "niche";
  description: string;
  badge?: string;
  accentColor: string;
  document: PageBuilderDocument;
}

export const DEFAULT_GLOBAL_TOKENS: GlobalTokens = {
  primaryColor: "#dcff4c", // Lime signature Reservei
  secondaryColor: "#a3e635",
  backgroundColor: "#09090b",
  surfaceColor: "#18181b",
  textColor: "#f4f4f5",
  textMutedColor: "#a1a1aa",
  borderColor: "#27272a",
  fontHeading: "Outfit",
  fontBody: "Inter",
  borderRadius: 12,
  containerWidth: 1200,
  themeMode: "dark",
};

export const TEMPLATES: PageTemplate[] = [
  {
    id: "classic",
    name: "Clássico Reservei",
    category: "general",
    badge: "Padrão",
    description: "Equilíbrio perfeito entre clareza, identidade de marca e conversão rápida de reservas.",
    accentColor: "#dcff4c",
    document: {
      schemaVersion: 2,
      name: "Clássico Reservei",
      globalTokens: DEFAULT_GLOBAL_TOKENS,
      sections: [
        {
          id: "sec-header",
          name: "Cabeçalho Principal",
          props: { paddingY: 16, fullWidth: false },
          blocks: [
            {
              id: "blk-header",
              type: "company-header",
              props: { showLogo: true, logoSize: 52, showName: true, showCategory: true, showMyBookingsButton: true, align: "space-between" },
            },
          ],
        },
        {
          id: "sec-cover",
          name: "Banner de Capa",
          props: { paddingY: 8, fullWidth: false },
          blocks: [
            {
              id: "blk-cover",
              type: "cover-banner",
              props: { heightDesktop: 220, heightMobile: 140, overlayOpacity: 25, borderRadius: 16 },
            },
          ],
        },
        {
          id: "sec-bio",
          name: "Apresentação & Sobre",
          props: { paddingY: 12, fullWidth: false },
          blocks: [
            {
              id: "blk-bio",
              type: "bio-presentation",
              props: { showDescription: true, showAddressBadge: true, showContactLinks: true, textAlign: "center" },
            },
          ],
        },
        {
          id: "sec-booking",
          name: "Agendamento & Catálogo",
          props: { paddingY: 16, fullWidth: false },
          blocks: [
            {
              id: "blk-search",
              type: "service-search",
              props: { placeholder: "Buscar serviço por nome...", showCategoryPills: true, pillStyle: "rounded" },
            },
            {
              id: "blk-services",
              type: "service-grid",
              isLocked: true,
              props: { columnsDesktop: 2, columnsMobile: 1, cardLayout: "horizontal", showImages: true, showDuration: true, cardBorderRadius: 12, gap: 12 },
            },
            {
              id: "blk-summary",
              type: "booking-summary",
              isLocked: true,
              props: { positionDesktop: "sidebar", positionMobile: "bottom-bar", ctaText: "Continuar", showTrustBadge: true },
            },
          ],
        },
        {
          id: "sec-map",
          name: "Localização & GPS",
          props: { paddingY: 20, fullWidth: false },
          blocks: [
            {
              id: "blk-map",
              type: "location-map",
              props: { title: "Localização & Como Chegar", mapHeight: 200, showAddressCard: true, showGpsButton: true, cardBorderRadius: 14 },
            },
          ],
        },
        {
          id: "sec-footer",
          name: "Rodapé",
          props: { paddingY: 24, fullWidth: false },
          blocks: [
            {
              id: "blk-footer",
              type: "footer",
              props: { showCopyright: true, showPoweredBy: true },
            },
          ],
        },
      ],
    },
  },

  {
    id: "minimalist",
    name: "Minimalista Clean",
    category: "general",
    badge: "Moderno",
    description: "Foco total na lista direta de serviços com design tipográfico e zero distrações.",
    accentColor: "#38bdf8",
    document: {
      schemaVersion: 2,
      name: "Minimalista Clean",
      globalTokens: {
        ...DEFAULT_GLOBAL_TOKENS,
        primaryColor: "#38bdf8",
        backgroundColor: "#030712",
        surfaceColor: "#111827",
        borderColor: "#1f2937",
        fontHeading: "Inter",
        fontBody: "Inter",
        borderRadius: 8,
      },
      sections: [
        {
          id: "sec-header",
          name: "Cabeçalho Enxuto",
          props: { paddingY: 16 },
          blocks: [
            {
              id: "blk-header",
              type: "company-header",
              props: { showLogo: true, logoSize: 44, showName: true, showCategory: false, showMyBookingsButton: true, align: "left" },
            },
          ],
        },
        {
          id: "sec-booking",
          name: "Serviços em Linha",
          props: { paddingY: 12 },
          blocks: [
            {
              id: "blk-search",
              type: "service-search",
              props: { placeholder: "Filtrar por serviço...", showCategoryPills: true, pillStyle: "square" },
            },
            {
              id: "blk-services",
              type: "service-grid",
              isLocked: true,
              props: { columnsDesktop: 1, columnsMobile: 1, cardLayout: "compact", showImages: false, showDuration: true, cardBorderRadius: 6, gap: 8 },
            },
            {
              id: "blk-summary",
              type: "booking-summary",
              isLocked: true,
              props: { positionDesktop: "sidebar", positionMobile: "bottom-bar", ctaText: "Agendar Horário", showTrustBadge: true },
            },
          ],
        },
        {
          id: "sec-map",
          name: "Endereço",
          props: { paddingY: 16 },
          blocks: [
            {
              id: "blk-map",
              type: "location-map",
              props: { title: "Endereço", mapHeight: 160, showAddressCard: true, showGpsButton: true, cardBorderRadius: 8 },
            },
          ],
        },
        {
          id: "sec-footer",
          name: "Rodapé",
          props: { paddingY: 20 },
          blocks: [{ id: "blk-footer", type: "footer", props: { showCopyright: true, showPoweredBy: true } }],
        },
      ],
    },
  },

  {
    id: "premium",
    name: "Premium Gold Edition",
    category: "general",
    badge: "Alto Padrão",
    description: "Estética refinada em tons dourados e pretos profundos, com galeria de fotos e FAQ.",
    accentColor: "#fbbf24",
    document: {
      schemaVersion: 2,
      name: "Premium Gold",
      globalTokens: {
        ...DEFAULT_GLOBAL_TOKENS,
        primaryColor: "#fbbf24",
        secondaryColor: "#f59e0b",
        backgroundColor: "#0c0a09",
        surfaceColor: "#1c1917",
        borderColor: "#292524",
        fontHeading: "Playfair Display",
        fontBody: "Outfit",
        borderRadius: 16,
      },
      sections: [
        {
          id: "sec-header",
          name: "Topo Premium",
          props: { paddingY: 20 },
          blocks: [
            {
              id: "blk-header",
              type: "company-header",
              props: { showLogo: true, logoSize: 64, showName: true, showCategory: true, showMyBookingsButton: true, align: "center" },
            },
          ],
        },
        {
          id: "sec-cover",
          name: "Capa Cenográfica",
          props: { paddingY: 10 },
          blocks: [
            {
              id: "blk-cover",
              type: "cover-banner",
              props: { heightDesktop: 280, heightMobile: 160, overlayOpacity: 35, borderRadius: 20 },
            },
          ],
        },
        {
          id: "sec-bio",
          name: "Apresentação",
          props: { paddingY: 16 },
          blocks: [
            {
              id: "blk-bio",
              type: "bio-presentation",
              props: { showDescription: true, showAddressBadge: true, showContactLinks: true, textAlign: "center", fontSize: 16 },
            },
          ],
        },
        {
          id: "sec-team",
          name: "Nossa Equipe de Especialistas",
          props: { paddingY: 16 },
          blocks: [
            {
              id: "blk-team",
              type: "professional-selector",
              props: { title: "Conheça Nossos Especialistas", avatarShape: "circle", avatarSize: 68, showJobTitle: true },
            },
          ],
        },
        {
          id: "sec-booking",
          name: "Menu de Experiências",
          props: { paddingY: 20 },
          blocks: [
            {
              id: "blk-search",
              type: "service-search",
              props: { placeholder: "O que você deseja vivenciar hoje?", showCategoryPills: true, pillStyle: "pill" },
            },
            {
              id: "blk-services",
              type: "service-grid",
              isLocked: true,
              props: { columnsDesktop: 3, columnsMobile: 1, cardLayout: "vertical", showImages: true, showDuration: true, cardBorderRadius: 16, gap: 16 },
            },
            {
              id: "blk-summary",
              type: "booking-summary",
              isLocked: true,
              props: { positionDesktop: "sidebar", positionMobile: "bottom-bar", ctaText: "Reservar Horário", showTrustBadge: true },
            },
          ],
        },
        {
          id: "sec-gallery",
          name: "Galeria do Espaço",
          props: { paddingY: 20 },
          blocks: [
            {
              id: "blk-gallery",
              type: "gallery-photos",
              props: { title: "Nosso Ambiente Exclusivo", columnsDesktop: 3, columnsMobile: 2, borderRadius: 14 },
            },
          ],
        },
        {
          id: "sec-faq",
          name: "Dúvidas Frequentes",
          props: { paddingY: 20 },
          blocks: [
            {
              id: "blk-faq",
              type: "faq-accordion",
              props: { title: "Perguntas Frequentes" },
            },
          ],
        },
        {
          id: "sec-map",
          name: "Localização",
          props: { paddingY: 20 },
          blocks: [
            {
              id: "blk-map",
              type: "location-map",
              props: { title: "Localização de Prestígio", mapHeight: 220, showAddressCard: true, showGpsButton: true, cardBorderRadius: 16 },
            },
          ],
        },
        {
          id: "sec-footer",
          name: "Rodapé",
          props: { paddingY: 32 },
          blocks: [{ id: "blk-footer", type: "footer", props: { showCopyright: true, showPoweredBy: true } }],
        },
      ],
    },
  },

  {
    id: "barbershop",
    name: "Barbearia / Barber Club",
    category: "niche",
    badge: "Barbearia",
    description: "Visual marcante em tons dark, cartões com duração destacada e foco na agilidade do barbeiro.",
    accentColor: "#f97316",
    document: {
      schemaVersion: 2,
      name: "Barbearia Club",
      globalTokens: {
        ...DEFAULT_GLOBAL_TOKENS,
        primaryColor: "#f97316",
        backgroundColor: "#0a0a0a",
        surfaceColor: "#141414",
        borderColor: "#262626",
        fontHeading: "Outfit",
        fontBody: "Inter",
        borderRadius: 10,
      },
      sections: [
        {
          id: "sec-header",
          name: "Cabeçalho da Barbearia",
          props: { paddingY: 16 },
          blocks: [
            {
              id: "blk-header",
              type: "company-header",
              props: { showLogo: true, logoSize: 56, showName: true, showCategory: true, showMyBookingsButton: true, align: "space-between" },
            },
          ],
        },
        {
          id: "sec-cover",
          name: "Capa do Espaço",
          props: { paddingY: 8 },
          blocks: [
            {
              id: "blk-cover",
              type: "cover-banner",
              props: { heightDesktop: 240, heightMobile: 150, overlayOpacity: 30, borderRadius: 12 },
            },
          ],
        },
        {
          id: "sec-team",
          name: "Barbeiros",
          props: { paddingY: 14 },
          blocks: [
            {
              id: "blk-team",
              type: "professional-selector",
              props: { title: "Escolha seu Barbeiro", avatarShape: "rounded", avatarSize: 64, showJobTitle: true },
            },
          ],
        },
        {
          id: "sec-booking",
          name: "Serviços de Corte & Barba",
          props: { paddingY: 16 },
          blocks: [
            {
              id: "blk-search",
              type: "service-search",
              props: { placeholder: "Corte, barba, pigmentação...", showCategoryPills: true, pillStyle: "rounded" },
            },
            {
              id: "blk-services",
              type: "service-grid",
              isLocked: true,
              props: { columnsDesktop: 2, columnsMobile: 1, cardLayout: "horizontal", showImages: true, showDuration: true, cardBorderRadius: 10, gap: 12 },
            },
            {
              id: "blk-summary",
              type: "booking-summary",
              isLocked: true,
              props: { positionDesktop: "sidebar", positionMobile: "bottom-bar", ctaText: "Agendar Meu Horário", showTrustBadge: true },
            },
          ],
        },
        {
          id: "sec-map",
          name: "Localização da Cadeira",
          props: { paddingY: 18 },
          blocks: [
            {
              id: "blk-map",
              type: "location-map",
              props: { title: "Onde nos encontrar", mapHeight: 190, showAddressCard: true, showGpsButton: true, cardBorderRadius: 12 },
            },
          ],
        },
        {
          id: "sec-footer",
          name: "Rodapé",
          props: { paddingY: 24 },
          blocks: [{ id: "blk-footer", type: "footer", props: { showCopyright: true, showPoweredBy: true } }],
        },
      ],
    },
  },

  {
    id: "salon",
    name: "Salão & Estética",
    category: "niche",
    badge: "Estética & Beleza",
    description: "Paleta delicada e moderna em rosa/violeta, abas de categorias destacadas e galeria de resultados.",
    accentColor: "#ec4899",
    document: {
      schemaVersion: 2,
      name: "Salão & Estética",
      globalTokens: {
        ...DEFAULT_GLOBAL_TOKENS,
        primaryColor: "#ec4899",
        backgroundColor: "#0d0914",
        surfaceColor: "#171226",
        borderColor: "#2d2447",
        fontHeading: "Plus Jakarta Sans",
        fontBody: "Inter",
        borderRadius: 16,
      },
      sections: [
        {
          id: "sec-header",
          name: "Cabeçalho Elegante",
          props: { paddingY: 18 },
          blocks: [
            {
              id: "blk-header",
              type: "company-header",
              props: { showLogo: true, logoSize: 56, showName: true, showCategory: true, showMyBookingsButton: true, align: "center" },
            },
          ],
        },
        {
          id: "sec-cover",
          name: "Banner Visual",
          props: { paddingY: 8 },
          blocks: [
            {
              id: "blk-cover",
              type: "cover-banner",
              props: { heightDesktop: 220, heightMobile: 140, overlayOpacity: 20, borderRadius: 16 },
            },
          ],
        },
        {
          id: "sec-booking",
          name: "Procedimentos & Cuidados",
          props: { paddingY: 16 },
          blocks: [
            {
              id: "blk-search",
              type: "service-search",
              props: { placeholder: "Encontre seu procedimento ideal...", showCategoryPills: true, pillStyle: "pill" },
            },
            {
              id: "blk-services",
              type: "service-grid",
              isLocked: true,
              props: { columnsDesktop: 2, columnsMobile: 1, cardLayout: "vertical", showImages: true, showDuration: true, cardBorderRadius: 14, gap: 14 },
            },
            {
              id: "blk-summary",
              type: "booking-summary",
              isLocked: true,
              props: { positionDesktop: "sidebar", positionMobile: "bottom-bar", ctaText: "Garantir Atendimento", showTrustBadge: true },
            },
          ],
        },
        {
          id: "sec-map",
          name: "Localização",
          props: { paddingY: 18 },
          blocks: [
            {
              id: "blk-map",
              type: "location-map",
              props: { title: "Local de Atendimento", mapHeight: 180, showAddressCard: true, showGpsButton: true, cardBorderRadius: 14 },
            },
          ],
        },
        {
          id: "sec-footer",
          name: "Rodapé",
          props: { paddingY: 24 },
          blocks: [{ id: "blk-footer", type: "footer", props: { showCopyright: true, showPoweredBy: true } }],
        },
      ],
    },
  },
];
