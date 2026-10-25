import { createContext, useContext } from "react";
import type { Learning } from "../persistence/storage";
export const LearningContext = createContext<{
  learning: Learning;
  update: (v: Learning) => void;
  record: (id: string, seed: number, passed: boolean) => void;
}>({ learning: null!, update: () => {}, record: () => {} });
export const useLearning = () => useContext(LearningContext);
