// Shared Resources Public API
// Cross-cutting concerns available to all features

// UI Components
export { Badge } from '@/components/shared/badge/badge';
export { Button } from '@/components/shared/button/Button';
export {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
export { Input } from '@/components/shared/input/input';
export { Label } from '@/shared/ui/label/label';
export { Select } from '@/components/shared/select/select';
export { default as SelectCustom } from '@/components/shared/selectCustom/SelectCustom';
export { Textarea } from '@/shared/ui/textarea/textarea';
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/ui/tabs/tabs';
export { default as Loader } from '@/components/shared/Loader/Loader';
export { EmptyState } from '@/components/shared/EmptyState/EmptyState';
export { default as BackButton } from '@/components/shared/BackButton/BackButton';
export { default as Modal } from '@/components/shared/modal';
export { SafeNavAnchor } from '@/shared/ui/navigation/SafeNavAnchor';

// Form Components
export { FormErrorSummary } from '@/components/shared/formErrorSummary/FormErrorSummary';
export { default as FormFieldError } from '@/components/shared/formFieldError/FormFieldError';

// Hooks
export * from './hooks/useToast';

// Types
export * from '@/shared/types/enumShared';
export * from '@/shared/types/userTypes';
export * from '@/shared/types/schemas/authSchema';

// Utils
export * from './utils/currencyHelpers';
export * from './utils/dateHelpers';
export * from './utils/statusHelpers';

// Constants
export * from '@/shared/constantsRoutes/routes';
export * from '@/shared/constantsRoutes/sidebarPermissions';
