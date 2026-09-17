import type { ComponentMeta, BlockType } from "./page-builder-types";

export const COMPONENT_REGISTRY: Record<BlockType, ComponentMeta> = {
  "company-header": {
    type: "company-header",
    name: "Cabeçalho da Empresa",
    category: "identity",
    iconName: "Building2",
    description: "Exibe o logo, nome do estabelecimento e botão Minhas Reservas.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      showLogo: true,
      logoSize: 52,
      showName: true,
      showCategory: true,
      showMyBookingsButton: true,
      myBookingsButtonText: "Minhas reservas",
      align: "center", // "left" | "center" | "space-between"
      paddingY: 16,
    },
    propDefinitions: [
      { name: "showLogo", label: "Exibir Logo", type: "switch", category: "content" },
      { name: "logoSize", label: "Tamanho do Logo (px)", type: "slider", min: 36, max: 96, step: 4, category: "layout" },
      { name: "showName", label: "Exibir Nome da Empresa", type: "switch", category: "content" },
      { name: "showCategory", label: "Exibir Segmento / Categoria", type: "switch", category: "content" },
      { name: "showMyBookingsButton", label: "Botão Minhas Reservas", type: "switch", category: "content" },
      { name: "myBookingsButtonText", label: "Texto do Botão", type: "text", category: "content" },
      {
        name: "align",
        label: "Alinhamento",
        type: "select",
        options: [
          { label: "Esquerda", value: "left" },
          { label: "Centralizado", value: "center" },
          { label: "Espaçado (Logo à esq, botão à dir)", value: "space-between" },
        ],
        category: "layout",
      },
      { name: "paddingY", label: "Espaçamento Vertical (px)", type: "slider", min: 8, max: 48, step: 4, category: "layout" },
    ],
  },

  "cover-banner": {
    type: "cover-banner",
    name: "Capa / Banner Superior",
    category: "identity",
    iconName: "Image",
    description: "Imagem de capa destacada com altura ajustável e efeito visual.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      heightDesktop: 220,
      heightMobile: 140,
      overlayOpacity: 30, // 0 to 80%
      borderRadius: 16,
      objectPosition: "center", // "center" | "top" | "bottom"
      showBadge: false,
    },
    propDefinitions: [
      { name: "heightDesktop", label: "Altura no Desktop (px)", type: "slider", min: 100, max: 480, step: 10, category: "layout" },
      { name: "heightMobile", label: "Altura no Celular (px)", type: "slider", min: 80, max: 280, step: 10, category: "layout" },
      { name: "overlayOpacity", label: "Escurecimento do Fundo (%)", type: "slider", min: 0, max: 80, step: 5, category: "style" },
      { name: "borderRadius", label: "Arredondamento da Borda (px)", type: "slider", min: 0, max: 32, step: 4, category: "style" },
      {
        name: "objectPosition",
        label: "Foco da Imagem",
        type: "select",
        options: [
          { label: "Centro", value: "center" },
          { label: "Topo", value: "top" },
          { label: "Base", value: "bottom" },
        ],
        category: "layout",
      },
    ],
  },

  "bio-presentation": {
    type: "bio-presentation",
    name: "Apresentação & Biografia",
    category: "identity",
    iconName: "FileText",
    description: "Descrição comercial, crachá de localização e canais de contato.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      showDescription: true,
      showAddressBadge: true,
      showContactLinks: true,
      textAlign: "center", // "left" | "center"
      fontSize: 15,
      lineHeight: 1.5,
    },
    propDefinitions: [
      { name: "showDescription", label: "Exibir Descrição", type: "switch", category: "content" },
      { name: "showAddressBadge", label: "Exibir Endereço", type: "switch", category: "content" },
      { name: "showContactLinks", label: "Exibir Links de Contato (WhatsApp/Insta)", type: "switch", category: "content" },
      {
        name: "textAlign",
        label: "Alinhamento do Texto",
        type: "select",
        options: [
          { label: "Esquerda", value: "left" },
          { label: "Centralizado", value: "center" },
        ],
        category: "layout",
      },
      { name: "fontSize", label: "Tamanho da Fonte (px)", type: "slider", min: 13, max: 20, step: 1, category: "style" },
    ],
  },

  "service-search": {
    type: "service-search",
    name: "Busca e Filtro de Categorias",
    category: "booking",
    iconName: "Search",
    description: "Barra de pesquisa em tempo real e seletor de categorias em pills.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      placeholder: "Buscar serviço por nome...",
      showCategoryPills: true,
      pillStyle: "rounded", // "rounded" | "square" | "pill"
      stickyOnScroll: false,
    },
    propDefinitions: [
      { name: "placeholder", label: "Texto do Placeholder", type: "text", category: "content" },
      { name: "showCategoryPills", label: "Exibir Filtro de Categorias", type: "switch", category: "content" },
      {
        name: "pillStyle",
        label: "Estilo dos Botões de Categoria",
        type: "select",
        options: [
          { label: "Pílula (Totalmente arredondado)", value: "pill" },
          { label: "Arredondado suave", value: "rounded" },
          { label: "Retangular", value: "square" },
        ],
        category: "style",
      },
    ],
  },

  "service-grid": {
    type: "service-grid",
    name: "Grade de Serviços",
    category: "booking",
    iconName: "Layers",
    description: "Catálogo interativo de serviços. Elemento essencial do fluxo de reservas.",
    isEssential: true,
    allowChildren: false,
    defaultProps: {
      columnsDesktop: 2, // 1, 2, 3, 4
      columnsTablet: 2,
      columnsMobile: 1,
      cardLayout: "horizontal", // "horizontal" | "vertical" | "compact" | "minimal"
      showImages: true,
      imageAspectRatio: "square", // "square" | "16:9" | "portrait"
      showDuration: true,
      showDescription: true,
      cardBorderRadius: 12,
      cardBackground: "surface", // "surface" | "transparent" | "card"
      gap: 12,
    },
    propDefinitions: [
      {
        name: "cardLayout",
        label: "Formato dos Cards",
        type: "select",
        options: [
          { label: "Horizontal (Clássico)", value: "horizontal" },
          { label: "Vertical (Imagem no topo)", value: "vertical" },
          { label: "Compacto (Linhas finas)", value: "compact" },
          { label: "Minimalista (Sem card)", value: "minimal" },
        ],
        category: "layout",
      },
      {
        name: "columnsDesktop",
        label: "Colunas no Computador",
        type: "select",
        options: [
          { label: "1 Coluna", value: 1 },
          { label: "2 Colunas", value: 2 },
          { label: "3 Colunas", value: 3 },
          { label: "4 Colunas", value: 4 },
        ],
        category: "responsive",
      },
      {
        name: "columnsMobile",
        label: "Colunas no Celular",
        type: "select",
        options: [
          { label: "1 Coluna", value: 1 },
          { label: "2 Colunas", value: 2 },
        ],
        category: "responsive",
      },
      { name: "showImages", label: "Exibir Imagens dos Serviços", type: "switch", category: "content" },
      { name: "showDuration", label: "Exibir Duração do Serviço", type: "switch", category: "content" },
      { name: "showDescription", label: "Exibir Descrição", type: "switch", category: "content" },
      { name: "cardBorderRadius", label: "Raio da Borda do Card (px)", type: "slider", min: 0, max: 24, step: 2, category: "style" },
      { name: "gap", label: "Espaçamento entre Cards (px)", type: "slider", min: 6, max: 32, step: 2, category: "layout" },
    ],
  },

  "professional-selector": {
    type: "professional-selector",
    name: "Equipe / Profissionais",
    category: "booking",
    iconName: "Users",
    description: "Mostra a equipe de especialistas disponíveis para atendimento.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      title: "Nossa Equipe",
      layout: "grid", // "grid" | "carousel" | "compact"
      avatarShape: "circle", // "circle" | "rounded" | "square"
      avatarSize: 60,
      showJobTitle: true,
      columns: 3,
    },
    propDefinitions: [
      { name: "title", label: "Título da Seção", type: "text", category: "content" },
      {
        name: "avatarShape",
        label: "Formato do Avatar",
        type: "select",
        options: [
          { label: "Circular", value: "circle" },
          { label: "Arredondado", value: "rounded" },
          { label: "Quadrado", value: "square" },
        ],
        category: "style",
      },
      { name: "avatarSize", label: "Tamanho do Avatar (px)", type: "slider", min: 40, max: 90, step: 4, category: "style" },
      { name: "showJobTitle", label: "Exibir Especialidade / Cargo", type: "switch", category: "content" },
    ],
  },

  "booking-summary": {
    type: "booking-summary",
    name: "Resumo do Agendamento",
    category: "booking",
    iconName: "ShoppingBag",
    description: "Carrinho de agendamento com subtotal, botão de confirmação e selo de segurança.",
    isEssential: true,
    allowChildren: false,
    defaultProps: {
      positionDesktop: "sidebar", // "sidebar" | "bottom" | "floating"
      positionMobile: "bottom-bar", // "bottom-bar" | "inline"
      ctaText: "Continuar",
      ctaBackground: "primary", // "primary" | "dark" | "custom"
      showTrustBadge: true,
      trustBadgeText: "Agendamento instantâneo & seguro",
      buttonBorderRadius: 10,
    },
    propDefinitions: [
      {
        name: "positionDesktop",
        label: "Posição no Computador",
        type: "select",
        options: [
          { label: "Barra Lateral Fixa (Recomendado)", value: "sidebar" },
          { label: "Barra Inferior Fixa", value: "bottom" },
        ],
        category: "layout",
      },
      {
        name: "positionMobile",
        label: "Posição no Celular",
        type: "select",
        options: [
          { label: "Barra Inferior Flutuante (Bottom Bar)", value: "bottom-bar" },
          { label: "Ao Final da Página", value: "inline" },
        ],
        category: "responsive",
      },
      { name: "ctaText", label: "Texto do Botão de Ação", type: "text", category: "content" },
      { name: "showTrustBadge", label: "Exibir Selo de Confiança", type: "switch", category: "content" },
      { name: "trustBadgeText", label: "Texto do Selo", type: "text", category: "content" },
      { name: "buttonBorderRadius", label: "Arredondamento do Botão (px)", type: "slider", min: 4, max: 28, step: 2, category: "style" },
    ],
  },

  "location-map": {
    type: "location-map",
    name: "Mapa da Localização com GPS",
    category: "identity",
    iconName: "MapPin",
    description: "Card interativo com mapa do estabelecimento e navegação GPS (Waze/Google Maps).",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      title: "Como Chegar",
      mapHeight: 180,
      showAddressCard: true,
      showGpsButton: true,
      cardBorderRadius: 14,
    },
    propDefinitions: [
      { name: "title", label: "Título da Seção", type: "text", category: "content" },
      { name: "mapHeight", label: "Altura do Mapa (px)", type: "slider", min: 120, max: 320, step: 10, category: "layout" },
      { name: "showAddressCard", label: "Exibir Detalhes do Endereço", type: "switch", category: "content" },
      { name: "showGpsButton", label: "Exibir Botão de Rota GPS", type: "switch", category: "content" },
      { name: "cardBorderRadius", label: "Arredondamento do Card (px)", type: "slider", min: 0, max: 24, step: 2, category: "style" },
    ],
  },

  "working-hours": {
    type: "working-hours",
    name: "Horários de Funcionamento",
    category: "content",
    iconName: "Clock",
    description: "Tabela organizada com dias e faixas de horários de atendimento.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      title: "Horário de Funcionamento",
      showTodayHighlight: true,
      layout: "table", // "table" | "badges"
    },
    propDefinitions: [
      { name: "title", label: "Título", type: "text", category: "content" },
      { name: "showTodayHighlight", label: "Destacar Dia Atual", type: "switch", category: "style" },
    ],
  },

  "gallery-photos": {
    type: "gallery-photos",
    name: "Galeria de Fotos",
    category: "identity",
    iconName: "Camera",
    description: "Grid visual com fotos do estabelecimento, trabalhos e ambiente.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      title: "Conheça Nosso Espaço",
      columnsDesktop: 3,
      columnsMobile: 2,
      aspectRatio: "square", // "square" | "portrait" | "landscape"
      borderRadius: 10,
    },
    propDefinitions: [
      { name: "title", label: "Título da Galeria", type: "text", category: "content" },
      {
        name: "columnsDesktop",
        label: "Colunas no Desktop",
        type: "select",
        options: [
          { label: "2 Colunas", value: 2 },
          { label: "3 Colunas", value: 3 },
          { label: "4 Colunas", value: 4 },
        ],
        category: "responsive",
      },
      {
        name: "columnsMobile",
        label: "Colunas no Celular",
        type: "select",
        options: [
          { label: "1 Coluna", value: 1 },
          { label: "2 Colunas", value: 2 },
        ],
        category: "responsive",
      },
      { name: "borderRadius", label: "Arredondamento das Fotos (px)", type: "slider", min: 0, max: 24, step: 2, category: "style" },
    ],
  },

  "faq-accordion": {
    type: "faq-accordion",
    name: "Perguntas Frequentes (FAQ)",
    category: "content",
    iconName: "HelpCircle",
    description: "Perguntas e respostas sanando dúvidas comuns dos clientes.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      title: "Perguntas Frequentes",
      items: [
        {
          question: "Preciso pagar antecipadamente?",
          answer: "Não! O pagamento pode ser feito presencialmente no estabelecimento após a conclusão do serviço.",
        },
        {
          question: "Como faço para cancelar ou remarcar?",
          answer: "Você pode acessar a aba 'Minhas Reservas' no topo da página ou informar seu PIN de acesso para gerenciar seus horários.",
        },
      ],
    },
    propDefinitions: [
      { name: "title", label: "Título do FAQ", type: "text", category: "content" },
    ],
  },

  "custom-text": {
    type: "custom-text",
    name: "Bloco de Texto Livre",
    category: "basics",
    iconName: "Type",
    description: "Insira títulos personalizados, avisos ou instruções especiais.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      tag: "p", // "h1" | "h2" | "h3" | "p" | "callout"
      content: "Insira sua mensagem ou instruções personalizadas aqui.",
      textAlign: "left", // "left" | "center" | "right"
      fontSize: 15,
      textColor: "default", // "default" | "primary" | "muted"
      paddingY: 10,
    },
    propDefinitions: [
      {
        name: "tag",
        label: "Tipo de Bloco",
        type: "select",
        options: [
          { label: "Título Grande (H1)", value: "h1" },
          { label: "Título Médio (H2)", value: "h2" },
          { label: "Subtítulo (H3)", value: "h3" },
          { label: "Parágrafo de Texto", value: "p" },
          { label: "Caixa de Destaque / Alerta", value: "callout" },
        ],
        category: "content",
      },
      { name: "content", label: "Conteúdo do Texto", type: "textarea", category: "content" },
      {
        name: "textAlign",
        label: "Alinhamento",
        type: "select",
        options: [
          { label: "Esquerda", value: "left" },
          { label: "Centro", value: "center" },
          { label: "Direita", value: "right" },
        ],
        category: "layout",
      },
      { name: "fontSize", label: "Tamanho da Fonte (px)", type: "slider", min: 12, max: 36, step: 1, category: "style" },
    ],
  },

  "footer": {
    type: "footer",
    name: "Rodapé da Página",
    category: "content",
    iconName: "LayoutTemplate",
    description: "Informações institucionais, copyright e selo Reservei.",
    isEssential: false,
    allowChildren: false,
    defaultProps: {
      showCopyright: true,
      customText: "Todos os direitos reservados.",
      showPoweredBy: true,
      paddingY: 24,
    },
    propDefinitions: [
      { name: "showCopyright", label: "Exibir Copyright", type: "switch", category: "content" },
      { name: "customText", label: "Texto Adicional", type: "text", category: "content" },
      { name: "showPoweredBy", label: "Exibir 'Desenvolvido por Reservei'", type: "switch", category: "content" },
      { name: "paddingY", label: "Espaçamento Vertical (px)", type: "slider", min: 12, max: 64, step: 4, category: "layout" },
    ],
  },

  "container": {
    type: "container",
    name: "Container & Grid",
    category: "basics",
    iconName: "Box",
    description: "Agrupador flexível de elementos para composição de colunas e seções.",
    isEssential: false,
    allowChildren: true,
    defaultProps: {
      direction: "column", // "column" | "row"
      columns: 2,
      gap: 16,
      paddingY: 16,
      paddingX: 16,
      background: "transparent",
      borderRadius: 12,
    },
    propDefinitions: [
      {
        name: "direction",
        label: "Disposição dos Filhos",
        type: "select",
        options: [
          { label: "Vertical (Coluna)", value: "column" },
          { label: "Horizontal (Linha)", value: "row" },
        ],
        category: "layout",
      },
      {
        name: "columns",
        label: "Colunas no Desktop",
        type: "select",
        options: [
          { label: "1 Coluna", value: 1 },
          { label: "2 Colunas", value: 2 },
          { label: "3 Colunas", value: 3 },
          { label: "4 Colunas", value: 4 },
        ],
        category: "layout",
      },
      { name: "gap", label: "Espaçamento entre Itens (px)", type: "slider", min: 0, max: 48, step: 4, category: "layout" },
      { name: "paddingY", label: "Padding Vertical (px)", type: "slider", min: 0, max: 64, step: 4, category: "layout" },
      { name: "paddingX", label: "Padding Horizontal (px)", type: "slider", min: 0, max: 64, step: 4, category: "layout" },
      { name: "borderRadius", label: "Raio da Borda (px)", type: "slider", min: 0, max: 32, step: 4, category: "style" },
    ],
  },
};

export const CATEGORY_LABELS: Record<string, string> = {
  basics: "Básicos & Estrutura",
  identity: "Identidade & Marca",
  booking: "Agendamento (Booking)",
  content: "Conteúdo Adicional",
};
