// 화면과 서버가 같은 이름과 단위를 쓰도록 자료 형식을 한곳에 모았습니다.
export type Unit = "g" | "kg" | "ml" | "L" | "ea" | "tsp" | "tbsp" | "cup";
export type Ingredient = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  roles: string[];
  unit: string;
  allergens: string[];
  gramsPerMl?: number;
  gramsPerEach?: number;
  spoonSafe?: boolean;
  description: string;
  sourceIds: string[];
};
export type Equipment = {
  id: string;
  name: string;
  capabilities: string[];
  description: string;
  heatSafe?: boolean;
};
export type Recipe = {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: number;
  servings: number;
  yieldCount: number;
  activeMin: number;
  totalMin: number;
  equipmentIds: string[];
  appliance: string;
  ingredients: {
    id: string;
    quantity: number;
    unit: string;
    optional?: boolean;
    role?: string;
  }[];
  steps: {
    text: string;
    advanced: string;
    timerMin?: number;
    check?: string;
  }[];
  tags: string[];
  sourceIds: string[];
  evidence: string;
  tested: boolean;
  cupMl?: number;
  minScale?: number;
  maxScale?: number;
  pan?: { shape: string; width: number; height?: number; depth: number };
};
export type Rule = {
  id: string;
  kind: string;
  fromId: string;
  to: { id: string; ratio: number; unit?: string }[];
  contexts: string[];
  description: string;
  conditions: string;
  changes: string;
  limits: string;
  evidence: string;
  sourceIds: string[];
};
export type Article = {
  id: string;
  title: string;
  type: string;
  category: string;
  summary: string;
  body: string[];
  advanced: string[];
  tags: string[];
  recipeIds: string[];
  sourceIds: string[];
  templateAsset?: string;
};
export type Catalog = {
  ingredients: Ingredient[];
  equipment: Equipment[];
  recipes: Recipe[];
  substitutions: Rule[];
  articles: Article[];
  challenges: any[];
  trends: any[];
  sources: any[];
};
export type Entry = {
  id: string;
  profileId?: string;
  version?: number;
  createdAt?: string;
  [key: string]: any;
};
export type Pantry = {
  ingredientId: string;
  quantity: number | string | null;
  unit: string;
  cupMl?: number;
};
export type MatchInput = {
  entryMode: "INGREDIENT_FIRST" | "RECIPE_FIRST";
  ingredientMode: "STRICT" | "INCLUDE" | "PANTRY";
  allowedIds: string[];
  mustUseIds: string[];
  excludedIds: string[];
  pantry: Pantry[];
  equipment: string[];
  targetRecipeId?: string;
  filters?: {
    maxTotalMinutes?: number;
    maxDifficulty?: number;
    appliance?: string;
    allowSubstitutions?: boolean;
    exploratory?: boolean;
  };
};
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
