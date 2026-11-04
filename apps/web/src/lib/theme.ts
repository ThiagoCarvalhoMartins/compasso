import { useState } from "react";

export type Theme = "light" | "dark";

// O script em index.html aplica o tema salvo antes da primeira pintura: mantenha a chave e as cores iguais às de lá.
const STORAGE_KEY = "compasso:theme";
const THEME_COLOR: Record<Theme, string> = { light: "#FAF7F2", dark: "#211F1C" };

/** Tema por dispositivo; sem escolha salva, o script em index.html segue a preferência do sistema. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  const setTheme = (next: Theme) => {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem armazenamento (ex.: modo privado): o tema vale até recarregar a página.
    }
  };

  return { theme, setTheme };
}
