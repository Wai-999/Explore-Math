import {
  ArrowUpRight,
  ArrowRight,
  Compass,
  Orbit,
  Trophy,
  Layers3,
  BookOpen,
  RotateCcw,
  Maximize2,
  ChevronRight,
  Check,
  SlidersHorizontal,
  MoveUpRight,
  Sparkles,
  ArrowDown,
  Bookmark,
  Sun,
  Moon,
  Download,
  Upload,
  Menu,
  X,
  Box,
  Activity,
  FlaskConical,
} from "lucide-react";
export const icons = {
  ArrowUpRight,
  ArrowRight,
  Compass,
  Orbit,
  Trophy,
  Layers3,
  BookOpen,
  RotateCcw,
  Maximize2,
  ChevronRight,
  Check,
  SlidersHorizontal,
  MoveUpRight,
  Sparkles,
  ArrowDown,
  Bookmark,
  Sun,
  Moon,
  Download,
  Upload,
  Menu,
  X,
  Box,
  Activity,
  FlaskConical,
};
export function Icon({
  name,
  size = 20,
  ...props
}: {
  name: keyof typeof icons;
  size?: number;
  className?: string;
}) {
  const C = icons[name];
  return <C size={size} strokeWidth={1.6} aria-hidden="true" {...props} />;
}
