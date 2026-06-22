import {
  Box, Users, ShoppingCart, Package, BarChart3, ClipboardList,
  Briefcase, Heart, Home, Star, Zap, Globe, Mail, Phone,
  FileText, Calendar, Tag, Truck, Factory, DollarSign,
  Building2, Layers, Settings, Folder, BookOpen, Target,
  LucideProps,
} from "lucide-react";

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Box, Users, ShoppingCart, Package, BarChart3, ClipboardList,
  Briefcase, Heart, Home, Star, Zap, Globe, Mail, Phone,
  FileText, Calendar, Tag, Truck, Factory, DollarSign,
  Building2, Layers, Settings, Folder, BookOpen, Target,
};

interface Props extends LucideProps {
  name?: string;
}

export function DynamicIcon({ name, ...props }: Props) {
  const Icon = (name && ICON_MAP[name]) ? ICON_MAP[name] : Box;
  return <Icon {...props} />;
}

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);
