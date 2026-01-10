import globals from "globals";
import pluginJs from "@eslint/js";
import prettier from "eslint-config-prettier";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
        ...globals.jest,
        "Chart": "readonly",
        "PDFModule": "readonly",
        "ClassModule": "readonly",
        "QuizModule": "readonly",
        "AuthModule": "readonly",
        "NavigationModule": "readonly",
        "ThemeManager": "readonly",
        "NotificationSystem": "readonly",
        "AIModule": "readonly",
        "ApexCharts": "readonly"
      }
    }
  },
  pluginJs.configs.recommended,
  prettier,
];