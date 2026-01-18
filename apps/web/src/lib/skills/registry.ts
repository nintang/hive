/**
 * Built-in Skills Registry
 *
 * Skills based on https://github.com/anthropics/skills
 * Adapted for E2B sandbox execution (model-agnostic).
 *
 * The DB only tracks which skills are enabled per project.
 */

import type { Skill, SkillCategory } from "./types"

/**
 * Skills from Anthropic's skills repository
 * https://github.com/anthropics/skills
 *
 * These are adapted for E2B execution with required packages.
 */
export const SKILLS: Record<string, Skill> = {
  // Document Skills (from anthropics/skills)
  xlsx: {
    id: "xlsx",
    name: "Excel Spreadsheets",
    icon: "FileXls",
    description:
      "Create and analyze Excel spreadsheets with formulas, data analysis, and financial modeling. Uses pandas for analysis and openpyxl for formula preservation.",
    category: "document",
    template: "data-analysis",
    packages: ["pandas", "openpyxl", "xlsxwriter"],
    source: "https://github.com/anthropics/skills/tree/main/skills/xlsx",
  },
  pptx: {
    id: "pptx",
    name: "PowerPoint Presentations",
    icon: "Presentation",
    description:
      "Create and edit PowerPoint presentations with professional layouts, charts, and design. Supports templates, slide layouts, and visual elements.",
    category: "document",
    template: "data-analysis",
    packages: ["python-pptx", "Pillow"],
    source: "https://github.com/anthropics/skills/tree/main/skills/pptx",
  },
  pdf: {
    id: "pdf",
    name: "PDF Documents",
    icon: "FilePdf",
    description:
      "Create, edit, merge, and extract from PDF documents. Includes text/table extraction, form filling, and document creation.",
    category: "document",
    template: "data-analysis",
    packages: ["pypdf", "reportlab", "pdfplumber"],
    source: "https://github.com/anthropics/skills/tree/main/skills/pdf",
  },
  docx: {
    id: "docx",
    name: "Word Documents",
    icon: "FileDoc",
    description:
      "Create and edit Word documents with formatting, tables, images, and styles. Supports templates and document coauthoring.",
    category: "document",
    template: "data-analysis",
    packages: ["python-docx", "docx2pdf"],
    source: "https://github.com/anthropics/skills/tree/main/skills/docx",
  },

  // Development Skills (from anthropics/skills)
  "webapp-testing": {
    id: "webapp-testing",
    name: "Web App Testing",
    icon: "TestTube",
    description:
      "Test web applications with automated browser testing, screenshot comparisons, and interaction verification.",
    category: "development",
    template: "data-analysis",
    packages: ["playwright", "pytest"],
    source: "https://github.com/anthropics/skills/tree/main/skills/webapp-testing",
  },

  // Analysis Skills
  "data-analysis": {
    id: "data-analysis",
    name: "Data Analysis",
    icon: "Table",
    description:
      "Analyze CSV, JSON, and other data formats with pandas, numpy, and scipy. Includes statistical analysis and data transformation.",
    category: "analysis",
    template: "data-analysis",
    packages: ["pandas", "numpy", "scipy"],
  },
  charts: {
    id: "charts",
    name: "Charts & Graphs",
    icon: "BarChart",
    description:
      "Create data visualizations with matplotlib, seaborn, and plotly. Generate interactive charts and publication-quality figures.",
    category: "analysis",
    template: "data-analysis",
    packages: ["matplotlib", "seaborn", "plotly", "kaleido"],
  },

  // Creative Skills (from anthropics/skills)
  "algorithmic-art": {
    id: "algorithmic-art",
    name: "Algorithmic Art",
    icon: "Sparkle",
    description:
      "Create generative and algorithmic art using Python. Generate patterns, fractals, and creative visual compositions.",
    category: "creative",
    template: "data-analysis",
    packages: ["Pillow", "numpy", "matplotlib", "noise"],
    source: "https://github.com/anthropics/skills/tree/main/skills/algorithmic-art",
  },

  // General Purpose
  python: {
    id: "python",
    name: "Python Code",
    icon: "Code",
    description:
      "Run arbitrary Python code in a secure sandbox. Useful for calculations, data processing, file operations, and automation.",
    category: "development",
    template: "base",
    packages: [],
  },
} as const

/**
 * Get a skill by ID
 */
export function getSkill(skillId: string): Skill | undefined {
  return SKILLS[skillId]
}

/**
 * Get all skills
 */
export function getAllSkills(): Skill[] {
  return Object.values(SKILLS)
}

/**
 * Get skills by category
 */
export function getSkillsByCategory(category: SkillCategory): Skill[] {
  return Object.values(SKILLS).filter((skill) => skill.category === category)
}

/**
 * Get the E2B template for a set of skills
 * Use the default code interpreter template - it has pandas, numpy, etc pre-installed
 */
export function getTemplateForSkills(_skillIds: string[]): string {
  // Use the default E2B code interpreter template
  // It comes with common data science packages pre-installed
  // Custom templates like "data-analysis" have port initialization issues
  return undefined as unknown as string // Let E2B use its default template
}

/**
 * Get all required packages for a set of skills
 */
export function getPackagesForSkills(skillIds: string[]): string[] {
  const skills = skillIds.map((id) => SKILLS[id]).filter(Boolean)
  const packages = new Set<string>()

  for (const skill of skills) {
    for (const pkg of skill.packages) {
      packages.add(pkg)
    }
  }

  return Array.from(packages)
}
